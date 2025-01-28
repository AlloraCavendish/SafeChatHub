import { useEffect, useRef, useState } from "react";
import "./chat.css";
import EmojiPicker from "emoji-picker-react";
import { toast } from "react-toastify";
import {
  arrayUnion,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/userStore";
import upload from "../../lib/upload";
import { format } from "timeago.js";
import { checkUrlSafety } from "../../lib/urlChecker";
import { encryptWithIV, decryptWithIV } from "../../lib/encryption";

const Chat = () => {
  const [chat, setChat] = useState({ messages: [] });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [img, setImg] = useState({file: null, url: "",});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { currentUser } = useUserStore();
  const { chatId, user, isCurrentUserBlocked, isReceiverBlocked } =
    useChatStore();

  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) {
      const shouldScroll = 
        endRef.current.scrollHeight - endRef.current.scrollTop <= 
        endRef.current.clientHeight + 100;

      if (shouldScroll) {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [chat.messages]);

  useEffect(() => {
    if (!chatId) {
      setChat({ messages: [] });
      return;
    }

    const unSub = onSnapshot(
      doc(db, "chats", chatId), 
      (res) => {
        setChat(res.exists() ? res.data() : { messages: [] });
      },
      (error) => {
        console.error("Error fetching chat:", error);
        setChat({ messages: [] });
      }
    );

    return () => {
      unSub();
    };
  }, [chatId]);

  const handleEmoji = (e) => {
    setText((prev) => prev + e.emoji);
    setOpen(false);
  };

  const handleImg = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error("Only image files are allowed");
      return;
    }

    setImg({
      file,
      url: URL.createObjectURL(file),
    });
  };

  const handleSend = async () => {
    const encryptedText = text ? encryptWithIV(text) : null;

    if (!encryptedText && !img.file){
      toast.warn("Please enter a message or upload an image.");
      return;
    }

    let imgUrl = null;

    const urlRegex = /\b((https?:\/\/|www\.)?[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})(\.[a-zA-Z]{2,})?)(\/[^\s]*)?\b/g;
    const urls = text.match(urlRegex);

    if (urls) {
      let suspiciousUrls = [];

      try {
        for (let url of urls) {
          const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `http://${url}`;
          const result = await checkUrlSafety(fullUrl);

          if (result.suspicious) {
            suspiciousUrls.push(url);
          }

          if (result.unsafe) {
            toast.error(`The URL "${url}" is flagged as unsafe.`);
            return;  
          }
        }

        if (suspiciousUrls.length > 0) {
          const userConfirmed = window.confirm(`The following URLs are flagged as suspicious:\n\n${suspiciousUrls.join('\n')}\n\nDo you want to proceed with sending this message?`);
          if (!userConfirmed) {
            toast.warn('Message not sent due to suspicious URLs detected.');
            return;
          }
        }

      } catch (err) {
        toast.error('There was an issue checking the URL. Please try again.');
        return;
      }
    }

    try {
      if (img.file) {
        imgUrl = await upload(img.file);
        console.log("Image uploaded successfully:", imgUrl);
      }

      const message = {
        senderId: currentUser.id,
        text: encryptedText,
        createdAt: new Date(),
        ...(imgUrl && { img: imgUrl }),
      };

      await updateDoc(doc(db, "chats", chatId), {
        messages: arrayUnion(message),
      });

      const userIDs = [currentUser.id, user.id];

      await Promise.all(userIDs.map(async (id) => {
        const userChatsRef = doc(db, "userchats", id);
        const userChatsSnapshot = await getDoc(userChatsRef);

        if (userChatsSnapshot.exists()) {
          const userChatsData = userChatsSnapshot.data();

          const chatIndex = userChatsData.chats.findIndex(
            (c) => c.chatId === chatId
          );

          if (chatIndex > -1) {
            const encryptedLastMessage = text
              ? encryptWithIV(text)
              : imgUrl
              ? encryptWithIV("Sent an image")
              : "";

            userChatsData.chats[chatIndex].lastMessage = encryptedLastMessage;
            userChatsData.chats[chatIndex].isSeen = id === currentUser.id;
            userChatsData.chats[chatIndex].updatedAt = Date.now();

            await updateDoc(userChatsRef, {
              chats: userChatsData.chats,
            });
          }
        }
      }));
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Failed to send the message. Please try again.");
    } finally {
      setImg({ file: null, url: "" });
      setText("");
      setError(null);
    }
  };

  return (
    <div className="chat">
      {}
      {!user || !chatId ? (
        <div className="no-chat-selected">
          <p>Select a chat to start messaging</p>
        </div>
      ) : (
        <>
      <div className="top">
        <div className="user">
          <img 
            src={user?.avatar || "./avatar.png"} 
            alt=""
            onError={(e) => {
              e.target.src = "./avatar.png";
            }}
          />
          <div className="texts">
            <span>{user?.username}</span>
            <p>Last seen {user?.lastSeen ? format(user.lastSeen) : 'recently'}</p>
          </div>
        </div>
      </div>
      <div className="center">
        {chat?.messages?.map((message) => {
          let decryptedText = "Unable to display message";
          try {
            if (message.text) {
              decryptedText = decryptWithIV(message.text);
      
              if (!decryptedText || decryptedText === "") {
                decryptedText = "Decryption failed or empty message.";
              }
            }
          } catch (error) {
            decryptedText = "Decryption error: Invalid encrypted data.";
          }

          return (
            <div
              className={`message ${message.senderId === currentUser?.id ? "own" : ""}`} 
              key={message?.createdAt}
            >
              <div className="texts">
                {message.img && <img src={message.img} alt="" />}
                <p>{decryptedText}</p>
                <span>{format(message.createdAt.toDate ? message.createdAt.toDate() : new Date(message.createdAt))}</span>
              </div>
            </div>
          );
        })}

        {img.url && (
          <div className="message own">
            <div className="texts">
              <img src={img.url} alt="" />
            </div>
          </div>
        )}
        <div ref={endRef}></div>
      </div>
      <div className="bottom">
        <input
          type="text"
          placeholder={
            isCurrentUserBlocked || isReceiverBlocked
              ? "You cannot send a message"
              : "Type a message..."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isCurrentUserBlocked || isReceiverBlocked || isLoading}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="emoji">
          <img
            src="./emoji.png"
            alt=""
            onClick={() => setOpen((prev) => !prev)}
          />
          <div className="picker">
            <EmojiPicker open={open} onEmojiClick={handleEmoji} />
          </div>
        </div>
        <button
          className="sendButton"
          onClick={handleSend}
          disabled={isCurrentUserBlocked || isReceiverBlocked || isLoading}
        >
          Send
        </button>
      </div>
      </>
      )}
    </div>
  );
};

export default Chat;