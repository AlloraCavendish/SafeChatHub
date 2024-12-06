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
import { format } from "timeago.js";
import { checkUrlSafety } from "../../lib/urlChecker";
import { AES, enc } from "crypto-js";

const GroupChat = () => {
  const [chat, setChat] = useState({ messages: [], participants: [] });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { currentUser } = useUserStore();
  const { chatId, isCurrentUserBlocked } = useChatStore();

  const endRef = useRef(null);

  // Scroll to the bottom when messages change
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

  // Fetch chat data from Firestore
  useEffect(() => {
    if (!chatId) {
      console.error("chatId is missing");
      return;
    }

    const unSub = onSnapshot(doc(db, "groupChats", chatId), (res) => {
      const data = res.data() || { messages: [], participants: [] };
      setChat(data);
    });

    return () => {
      unSub();
    };
  }, [chatId]);

  const handleEmoji = (e) => {
    setText((prev) => prev + e.emoji);
    setOpen(false);
  };

  const handleSend = async () => {
    const encryptedText = text && AES.encrypt(text, "secretKey").toString();

    if (!encryptedText) {
      toast.warn("Please enter a message.");
      return;
    }

    const urlRegex = /((https?:\/\/)?([^\s\/$.?#].[^\s]*))/g;
    const urls = text.match(urlRegex);

    if (urls) {
      let suspiciousUrls = [];

      try {
        for (let url of urls) {
          const fullUrl = url.startsWith("http://") || url.startsWith("https://") ? url : `http://${url}`;
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
          const userConfirmed = window.confirm(
            `The following URLs are flagged as suspicious:\n\n${suspiciousUrls.join("\n")}\n\nDo you want to proceed with sending this message?`
          );
          if (!userConfirmed) {
            toast.warn("Message not sent due to suspicious URLs detected.");
            return;
          }
        }
      } catch (err) {
        toast.error("There was an issue checking the URL. Please try again.");
        return;
      }
    }

    try {
      const message = {
        senderId: currentUser.id,
        senderName: currentUser.username,
        text: encryptedText,
        createdAt: new Date(),
      };

      await updateDoc(doc(db, "groupChats", chatId), {
        messages: arrayUnion(message),
      });

      // Update last message for all participants
      const participantsUpdate = chat.participants.map(async (participantId) => {
        const userChatsRef = doc(db, "userGroupChats", participantId);
        const userChatsSnapshot = await getDoc(userChatsRef);

        if (userChatsSnapshot.exists()) {
          const userChatsData = userChatsSnapshot.data();
          const chatIndex = userChatsData.chats.findIndex(
            (c) => c.chatId === chatId
          );

          if (chatIndex > -1) {
            const encryptedLastMessage = AES.encrypt(text, "secretKey").toString();
            userChatsData.chats[chatIndex].lastMessage = encryptedLastMessage;
            userChatsData.chats[chatIndex].isSeen = participantId === currentUser.id;
            userChatsData.chats[chatIndex].updatedAt = Date.now();

            await updateDoc(userChatsRef, {
              chats: userChatsData.chats,
            });
          }
        }
      });

      await Promise.all(participantsUpdate);
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Failed to send the message. Please try again.");
    } finally {
      setText("");
    }
  };

  return (
    <div className="chat">
      <div className="top">
        <div className="user">
          <img
            src="./group-avatar.png"
            alt=""
            onError={(e) => {
              e.target.src = "./avatar.png";
            }}
          />
          <div className="texts">
            <span>{chat.name || "Group Chat"}</span>
            <p>{chat.participants?.length || 0} participants</p>
          </div>
        </div>
      </div>
      <div className="center">
        {chat?.messages?.map((message) => {
          let decryptedText = "Unable to display message";
          try {
            if (message.text) {
              const bytes = AES.decrypt(message.text, "secretKey");
              decryptedText = bytes.toString(enc.Utf8);

              if (!decryptedText) {
                decryptedText = "Decryption failed";
              }
            }
          } catch (error) {
            console.error("Decryption error:", error);
          }

          return (
            <div
              className={`message ${message.senderId === currentUser?.id ? "own" : ""}`}
              key={message?.createdAt}
            >
              <div className="texts">
                {message.senderId !== currentUser?.id && (
                  <span className="sender-name">{message.senderName}</span>
                )}
                <p>{decryptedText}</p>
                <span>
                  {format(
                    message.createdAt.toDate
                      ? message.createdAt.toDate()
                      : new Date(message.createdAt)
                  )}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={endRef}></div>
      </div>
      <div className="bottom">
        <input
          type="text"
          placeholder={
            isCurrentUserBlocked
              ? "You cannot send a message"
              : "Type a message..."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isCurrentUserBlocked || isLoading}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
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
          disabled={isCurrentUserBlocked || isLoading}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default GroupChat;
