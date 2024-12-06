// groupChatService.js

import { 
    collection,
    doc,
    setDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    getDoc,
    getDocs,
    query,
    where
  } from "firebase/firestore";
  import { db } from "./firebase";
  import { AES } from "crypto-js";
  
  export const createGroupChat = async (name, creatorId, participants) => {
    const groupChatRef = doc(collection(db, "groupChats"));
    const chatId = groupChatRef.id;
  
    const groupChatData = {
      id: chatId,
      name,
      creatorId,
      participants: [creatorId, ...participants],
      messages: [],
      createdAt: new Date(),
    };
  
    await setDoc(groupChatRef, groupChatData);
  
    const encryptedGroupName = AES.encrypt(name, "secretKey").toString();
  
    // Add group chat to all participants' userGroupChats
    const participantUpdates = [creatorId, ...participants].map(async (userId) => {
      const userGroupChatsRef = doc(db, "userGroupChats", userId);
      const userGroupChatsSnap = await getDoc(userGroupChatsRef);
  
      const chatData = {
        chatId,
        name: encryptedGroupName,
        participants: [creatorId, ...participants],
        lastMessage: "",
        isSeen: userId === creatorId,
        updatedAt: Date.now(),
      };
  
      if (userGroupChatsSnap.exists()) {
        await updateDoc(userGroupChatsRef, {
          chats: arrayUnion(chatData),
        });
      } else {
        await setDoc(userGroupChatsRef, {
          chats: [chatData],
        });
      }
    });
  
    await Promise.all(participantUpdates);
    return chatId;
  };
  
  export const addParticipant = async (chatId, userId) => {
    const groupChatRef = doc(db, "groupChats", chatId);
    const groupChatSnap = await getDoc(groupChatRef);
  
    if (!groupChatSnap.exists()) {
      throw new Error("Group chat not found");
    }
  
    const groupData = groupChatSnap.data();
    
    await updateDoc(groupChatRef, {
      participants: arrayUnion(userId),
    });
  
    const userGroupChatsRef = doc(db, "userGroupChats", userId);
    const encryptedGroupName = AES.encrypt(groupData.name, "secretKey").toString();
  
    const chatData = {
      chatId,
      name: encryptedGroupName,
      participants: [...groupData.participants, userId],
      lastMessage: "",
      isSeen: true,
      updatedAt: Date.now(),
    };
  
    const userGroupChatsSnap = await getDoc(userGroupChatsRef);
  
    if (userGroupChatsSnap.exists()) {
      await updateDoc(userGroupChatsRef, {
        chats: arrayUnion(chatData),
      });
    } else {
      await setDoc(userGroupChatsRef, {
        chats: [chatData],
      });
    }
  };
  
  export const removeParticipant = async (chatId, userId) => {
    const groupChatRef = doc(db, "groupChats", chatId);
    
    await updateDoc(groupChatRef, {
      participants: arrayRemove(userId),
    });
  
    const userGroupChatsRef = doc(db, "userGroupChats", userId);
    const userGroupChatsSnap = await getDoc(userGroupChatsRef);
  
    if (userGroupChatsSnap.exists()) {
      const userData = userGroupChatsSnap.data();
      const updatedChats = userData.chats.filter(chat => chat.chatId !== chatId);
  
      await updateDoc(userGroupChatsRef, {
        chats: updatedChats,
      });
    }
  };
  
  // Firebase Schema
  const groupChatSchema = {
    id: "string",
    name: "string",
    creatorId: "string",
    participants: ["userId"],
    messages: [{
      senderId: "string",
      senderName: "string",
      text: "string (encrypted)",
      createdAt: "timestamp"
    }],
    createdAt: "timestamp"
  };
  
  const userGroupChatsSchema = {
    chats: [{
      chatId: "string",
      name: "string (encrypted)",
      participants: ["userId"],
      lastMessage: "string (encrypted)",
      isSeen: "boolean",
      updatedAt: "timestamp"
    }]
  };