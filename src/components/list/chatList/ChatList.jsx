import { useEffect, useState } from "react";
import "./chatList.css";
import AddUser from "./addUser/addUser";
import { useUserStore } from "../../../lib/userStore";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db, auth } from "../../../lib/firebase";
import { useChatStore } from "../../../lib/chatStore";
import { toast } from "react-toastify";
import { decryptLastMessage } from "../../../lib/encryption";


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
            displayMessage: decryptedLastMessage,
          };
        });

        const chatData = await Promise.all(promises);

        const validChats = chatData.filter((chat) => chat !== null);

        useChatStore.setState({
          chats: validChats.sort((a, b) => b.updatedAt - a.updatedAt),
        });
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

    const chatIndex = userChats.findIndex((item) => item.chatId === chat.chatId);

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

        {!addUserMode && (
          <img
            src="./plus.png"
            alt=""
            className="add"
            onClick={() => setAddUserMode(true)}
          />
        )}
      </div>

      <div className="user-section">
        <div className="buttons-container">
        </div>
      </div>

       {filteredChats.length > 0 ? (
        filteredChats.map((chat) => (
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
        ))
      ) : (
        <div className="center-message">
          Select a chat to start a conversation
        </div>
      )}

      {addUserMode && <AddUser onClose={() => setAddUserMode(false)} />}
      {createGroupMode && (
        <GroupChat setCreateGroupMode={setCreateGroupMode} />
      )}
    </div>
  );
};

export default ChatList;