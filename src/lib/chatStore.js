import { create } from "zustand";
import { doc, deleteDoc, updateDoc, arrayRemove, collection, query, getDocs, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useUserStore } from "./userStore";
import { toast } from "react-toastify";  // Import toast here

export const useChatStore = create((set, get) => ({
  chatId: null,
  user: null,
  isCurrentUserBlocked: false,
  isReceiverBlocked: false,
  chats: [],
  
  // Function to reset the chat state
  resetChat: () => {
    set({
      chatId: null,
      user: null,
      isCurrentUserBlocked: false,
      isReceiverBlocked: false,
    });
  },

  changeChat: (chatId, user) => {
    const currentUser = useUserStore.getState().currentUser;

    // CHECK IF CURRENT USER IS BLOCKED
    if (user.blocked.includes(currentUser.id)) {
      return set({
        chatId,
        user: null,
        isCurrentUserBlocked: true,
        isReceiverBlocked: false,
      });
    }

    // CHECK IF RECEIVER IS BLOCKED
    else if (currentUser.blocked.includes(user.id)) {
      return set({
        chatId,
        user: user,
        isCurrentUserBlocked: false,
        isReceiverBlocked: true,
      });
    } else {
      return set({
        chatId,
        user,
        isCurrentUserBlocked: false,
        isReceiverBlocked: false,
      });
    }
  },

  changeBlock: () => {
    set((state) => ({ ...state, isReceiverBlocked: !state.isReceiverBlocked }));
  },

  deleteFriend: async () => {
    const { user, chatId } = get();
    const currentUser = useUserStore.getState().currentUser;
  
    if (!user || !currentUser) return;
  
    try {
      const currentUserRef = doc(db, "users", currentUser.id);
      await updateDoc(currentUserRef, {
        friends: arrayRemove(user.id),
      });
  
      const friendUserRef = doc(db, "users", user.id);
      await updateDoc(friendUserRef, {
        friends: arrayRemove(currentUser.id),
      });
  
      // Delete from 'chats' collection
      if (chatId) {
        await deleteDoc(doc(db, "chats", chatId));
  
        // Also delete messages within that chat
        const messagesRef = collection(db, "chats", chatId, "messages");
        const q = query(messagesRef);
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (document) => {
          await deleteDoc(document.ref);
        });
      }
  
      // Delete from 'userchats' collection
      const currentUserChatsRef = doc(db, "userchats", currentUser.id);
      const friendUserChatsRef = doc(db, "userchats", user.id);
  
      const currentUserChatsSnapshot = await getDoc(currentUserChatsRef);
      const friendUserChatsSnapshot = await getDoc(friendUserChatsRef);
  
      if (currentUserChatsSnapshot.exists()) {
        const currentUserChatsData = currentUserChatsSnapshot.data();
        const updatedCurrentUserChats = currentUserChatsData.chats.filter(
          (chat) => chat.chatId !== chatId
        );
  
        await updateDoc(currentUserChatsRef, {
          chats: updatedCurrentUserChats,
        });
      }
  
      if (friendUserChatsSnapshot.exists()) {
        const friendUserChatsData = friendUserChatsSnapshot.data();
        const updatedFriendUserChats = friendUserChatsData.chats.filter(
          (chat) => chat.chatId !== chatId
        );
  
        await updateDoc(friendUserChatsRef, {
          chats: updatedFriendUserChats,
        });
      }
  
      // Reset chat state
      get().resetChat();
      set((state) => ({
        chats: state.chats.filter((chat) => chat.chatId !== chatId),
      }));
  
      toast.success("Friend deleted successfully.");
    } catch (error) {
      console.error("Error deleting friend:", error);
      toast.error("Failed to delete friend.");
    }
  }  
}));
