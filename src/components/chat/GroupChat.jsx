import { useState, useRef, useEffect } from "react";
import "./groupchat.css";
import { AES } from "crypto-js";
import { toast } from "react-toastify";
import { db } from "../../lib/firebase";
import { useUserStore } from "../../lib/userStore";
import upload from "../../lib/upload";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  arrayUnion,
} from "firebase/firestore";

const GroupChat = () => {
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState([]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [img, setImg] = useState({ file: null, url: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [groupDocId, setGroupDocId] = useState(null);

  const { currentUser } = useUserStore();
  const messageRef = useRef(null);

  const scrollToBottom = () => {
    messageRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleCreateGroup = async () => {
    if (!groupName || members.length === 0) {
      toast.warn("Group name and members are required");
      return;
    }

    const groupData = {
      name: groupName,
      members: [...members, currentUser.id],
      createdAt: new Date(),
      messages: [],
    };

    try {
      const docRef = await addDoc(collection(db, "groupchats"), groupData);
      setGroupDocId(docRef.id);
      toast.success("Group created successfully");
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group");
    }
  };

  const handleSendMessage = async () => {
    if (!message && !img.file) {
      toast.warn("Please enter a message or upload an image");
      return;
    }

    const encryptedMessage = message && AES.encrypt(message, "secretKey").toString();
    let imgUrl = null;

    if (img.file) {
      imgUrl = await upload(img.file);
    }

    const newMessage = {
      senderId: currentUser.id,
      text: encryptedMessage,
      img: imgUrl,
      createdAt: new Date(),
    };

    try {
      await updateDoc(doc(db, "groupchats", groupDocId), {
        messages: arrayUnion(newMessage),
      });

      setMessages((prev) => [...prev, newMessage]);
      setMessage("");
      setImg({ file: null, url: "" });
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleAddMember = (userId) => {
    if (!members.includes(userId)) {
      setMembers((prev) => [...prev, userId]);
    } else {
      toast.warn("Member already added");
    }
  };

  return (
    <div className="groupchat">
      <div className="top">
        <input
          type="text"
          placeholder="Enter group name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          disabled={!!groupDocId}
        />
        <button onClick={handleCreateGroup} disabled={!!groupDocId}>
          Create Group
        </button>
      </div>
      <div className="center">
        {messages.map((msg, idx) => {
          let decryptedText = "Unable to display message";

          try {
            if (msg.text) {
              const bytes = AES.decrypt(msg.text, "secretKey");
              decryptedText = bytes.toString(enc.Utf8);
            }
          } catch (error) {
            console.error("Decryption error:", error);
          }

          return (
            <div key={idx} className={`message ${msg.senderId === currentUser.id ? "own" : ""}`}>
              {msg.img && <img src={msg.img} alt="" />}
              <p>{decryptedText}</p>
            </div>
          );
        })}
        <div ref={messageRef}></div>
      </div>
      <div className="bottom">
        <input
          type="file"
          id="file"
          style={{ display: "none" }}
          onChange={(e) => setImg({ file: e.target.files[0], url: URL.createObjectURL(e.target.files[0]) })}
        />
        <label htmlFor="file">
          <img src="./img.png" alt="Upload" />
        </label>
        <input
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
};

export default GroupChat;
