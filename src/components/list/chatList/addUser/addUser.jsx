import "./addUser.css";
import { db } from "../../../../lib/firebase";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  getDoc,
} from "firebase/firestore";
import { useState, useRef, useEffect } from "react";
import { useUserStore } from "../../../../lib/userStore";

const AddUser = ({ onClose }) => {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const { currentUser } = useUserStore();
  const addUserRef = useRef(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.target);
    const username = formData.get("username");

    if (username === currentUser.username) {
      setError("You cannot add yourself");
      setUser(null);
      return;
    }

    try {
      const userRef = collection(db, "users");
      const q = query(userRef, where("username", "==", username));
      const querySnapShot = await getDocs(q);

      if (!querySnapShot.empty) {
        setUser(querySnapShot.docs[0].data());
      } else {
        setError("User not found");
        setUser(null);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("An error occurred while searching");
    }
  };

  const createUserChatDocIfNeeded = async (userId) => {
    const userChatsRef = doc(db, "userchats", userId);
    const userChatDoc = await getDoc(userChatsRef);
    
    if (!userChatDoc.exists()) {
      await setDoc(userChatsRef, {
        chats: []
      });
    }
  };

  const handleAdd = async () => {
    if (!user || !currentUser) return;

    try {
      const chatRef = collection(db, "chats");
      const newChatRef = doc(chatRef);
      await setDoc(newChatRef, {
        createdAt: serverTimestamp(),
        messages: [],
        participants: [currentUser.id, user.id]
      });

      await createUserChatDocIfNeeded(user.id);
      await createUserChatDocIfNeeded(currentUser.id);

      const chatData = {
        chatId: newChatRef.id,
        lastMessage: "",
        updatedAt: Date.now(),
      };

      await updateDoc(doc(db, "userchats", user.id), {
        chats: arrayUnion({
          ...chatData,
          receiverId: currentUser.id
        }),
      });

      await updateDoc(doc(db, "userchats", currentUser.id), {
        chats: arrayUnion({
          ...chatData,
          receiverId: user.id
        }),
      });

      if (onClose) onClose();
    } catch (err) {
      console.error("Add user error:", err);
      setError("An error occurred while adding user");
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addUserRef.current && !addUserRef.current.contains(event.target)) {
        if (onClose) onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleClearInput = () => {
    setInputValue("");
    setError(null);
    setUser(null);
  };

  return (
    <div className="addUser" ref={addUserRef}>
      <form onSubmit={handleSearch}>
      <div className="input-wrapper">
          <input
            type="text"
            placeholder="Username"
            name="username"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            required
          />
          <button
            type="button"
            className="clear-button"
            onClick={handleClearInput}
          >
            Clear Box
          </button>
        </div>
        <button type="submit">Search</button>
      </form>
      
      {error && <div className="error">{error}</div>}
      
      {user && (
        <div className="user">
          <div className="detail">
            <img 
              src={user.avatar || "./avatar.png"} 
              alt={`${user.username}'s avatar`} 
            />
            <span>{user.username}</span>
          </div>
          <button onClick={handleAdd}>Add User</button>
        </div>
      )}
    </div>
  );
};

export default AddUser;