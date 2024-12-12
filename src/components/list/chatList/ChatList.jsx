import { useEffect, useState } from "react";
import "./chatList.css";
import AddUser from "./addUser/addUser";
import GroupChat from "../../chat/GroupChat";
import { useUserStore } from "../../../lib/userStore";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db, auth } from "../../../lib/firebase";
import { useChatStore } from "../../../lib/chatStore";
import { signOut } from "firebase/auth";
import { toast } from "react-toastify";
import { AES, enc } from "crypto-js";

const ChatList = () => {
  const [groupChats, setGroupChats] = useState([]);
  const [addMode, setAddMode] = useState(false);
  const [input, setInput] = useState("");
  const [addUserMode, setAddUserMode] = useState(false);
  const [createGroupMode, setCreateGroupMode] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const { currentUser } = useUserStore();
  const { chatId, changeChat, chats } = useChatStore((state) => ({
    chatId: state.chatId,
    changeChat: state.changeChat,
    chats: state.chats,
  }));
  
  const decryptLastMessage = (encryptedMessage) => {
    if (!encryptedMessage) return "";
    
    try {
      const bytes = AES.decrypt(encryptedMessage, "secretKey");
      const decryptedMessage = bytes.toString(enc.Utf8);
      
      if (!decryptedMessage) {
        return "Unable to display message";
      }
      
      return decryptedMessage;
    } catch (error) {
      console.error("Message decryption error:", error);
      return "Unable to display message";
    }
  };

  useEffect(() => {
    const fetchGroupChats = async () => {
      if (currentUser) {
        const groupDocsRef = doc(db, "users", currentUser.id);
        const groupDocsSnapshot = await getDoc(groupDocsRef);
        setGroupChats(groupDocsSnapshot.data()?.groupChats || []);
      }
    };

    fetchGroupChats();
  }, [currentUser]);


  useEffect(() => {
    const unSub = onSnapshot(
      doc(db, "userchats", currentUser.id),
      async (res) => {
        if (!res.exists()) {
          useChatStore.setState({ chats: [] });
          return;
        }
        const items = res.data().chats;

        const promises = items.map(async (item) => {
          const userDocRef = doc(db, "users", item.receiverId);
          const userDocSnap = await getDoc(userDocRef);

          if (!userDocSnap.exists()) {
            return null;
          }

          const user = userDocSnap.data();

          if (user.blocked?.includes(currentUser.id)) {
            return null;
          }
          
          const decryptedLastMessage = decryptLastMessage(item.lastMessage);
          
          return { 
            ...item, 
            user,
            displayMessage: decryptedLastMessage 
          };
        });

        const chatData = await Promise.all(promises);

        const validChats = chatData.filter((chat) => chat !== null);
      
        useChatStore.setState({ chats: validChats.sort((a, b) => b.updatedAt - a.updatedAt) });
      }
    );

    return () => {
      unSub();
    };
  }, [currentUser.id]);

  const handleSelect = async (chat) => {
    const userChats = chats.map((item) => {
      const { user, displayMessage, ...rest } = item;
      return rest;
    });

    const chatIndex = userChats.findIndex(
      (item) => item.chatId === chat.chatId
    );

    userChats[chatIndex].isSeen = true;

    const userChatsRef = doc(db, "userchats", currentUser.id);

    try {
      await updateDoc(userChatsRef, {
        chats: userChats,
      });
      changeChat(chat.chatId, chat.user);
    } catch (err) {
      console.log(err);
      toast.error("Failed to update chat status");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully!");
      window.location.reload();
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("Failed to log out.");
    }
  };

  const filteredChats = (chats || []).filter((c) => 
    c.user && c.user.username.toLowerCase().includes(input.toLowerCase())
  );
   

  return (
    <div className="chatList">
      <div className="search">
        <div className="searchBar">
          <img src="./search.png" alt="" />
          <input
            type="text"
            placeholder="Search"
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <img
          src={addMode ? "./minus.png" : "./plus.png"}
          alt=""
          className="add"
          onClick={() => setAddMode((prev) => !prev)}
        />
      </div>

      <div className="user-section">
        <img
          src={currentUser?.avatar || "./avatar.png"}
          alt="Avatar"
          className="avatar"
        />
       <div className="buttons-container">
          {/* <button 
            onClick={() => {
              setCreateGroupMode(true);
              setAddUserMode(false);
            }} 
            className="create-group-button"
          >
            Create Group
          </button> */}
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>

      {filteredChats.map((chat) => (
        <div
          className="item"
          key={chat.chatId}
          onClick={() => handleSelect(chat)}
          style={{
            backgroundColor: chat?.isSeen ? "transparent" : "#5183fe",
          }}
        >
          <img
            src={
              chat.user?.blocked?.includes(currentUser?.id)
                ? "./avatar.png"
                : chat.user?.avatar || "./avatar.png"
            }
            alt=""
          />
          <div className="texts">
            <span>
              {chat.user?.blocked?.includes(currentUser?.id)
                ? "User"
                : chat.user?.username}
            </span>
            <p>{chat.displayMessage}</p>
          </div>
        </div>
      ))}

      {addMode && <AddUser />}
      
      {createGroupMode && (
        <GroupChat 
          setCreateGroupMode={setCreateGroupMode} 
          setSelectedGroup={setSelectedGroup}
        />
      )}
    </div>
  );
};

export default ChatList;