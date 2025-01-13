import { useState, useEffect } from "react";
import { arrayRemove, arrayUnion, doc, updateDoc, getDoc,  } from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";
import { useChatStore } from "../../lib/chatStore";
import { auth, db } from "../../lib/firebase";
import { useUserStore } from "../../lib/userStore";
import { changePassword } from "../../lib/changePassword";
import { changeProfilePicture } from "../../lib/changeProfilePicture";
import "./detail.css";
import { AES, enc } from "crypto-js";

const Detail = () => {
  const { chatId, user, isCurrentUserBlocked, isReceiverBlocked, changeBlock, resetChat, deleteFriend } =
    useChatStore();
  const { currentUser } = useUserStore();
  const [avatar, setAvatar] = useState(user?.avatar || "./avatar.png");


  const handleRemoveFriend = async () => {
    const confirmRemove = window.confirm(`Are you sure you want to remove ${user.username} from your friends?`);
    
    if (confirmRemove) {
      try {
        await deleteFriend();
      } catch (error) {
        console.error("Error removing friend:", error);
      }
    }
  };

  const handleChangePassword = async () => {
    try {
      await changePassword();
    } catch (error) {
      console.error("Error changing password:", error);
    }
  };

  const handleChangeProfilePicture = async () => {
    if (currentUser) {
      try {
        const updatedAvatar = await changeProfilePicture(currentUser.id);
        setAvatar(updatedAvatar); // Update the avatar state with the new URL
      } catch (error) {
        console.error("Error updating profile picture:", error);
      }
    }
  }; 

  const [sections, setSections] = useState({
    chatSettings: false,
    privacySettings: false,
    sharedPhotos: true,
    sharedFiles: false
  });
  
  const [sharedMedia, setSharedMedia] = useState({
    photos: [],
    files: []
  });
  
  const [loading, setLoading] = useState(false);
  const [userStatus, setUserStatus] = useState({
    lastSeen: null,
    isOnline: false
  });

  useEffect(() => {
    const fetchSharedMedia = async () => {
      if (!chatId) return;
      
      try {
        setLoading(true);
        const chatDoc = await getDoc(doc(db, "chats", chatId));
        
        if (chatDoc.exists()) {
          const messages = chatDoc.data().messages || [];
          const photos = [];
          const files = [];
          
          messages.forEach(message => {
            if (message.img) {
              let caption = "";
              if (message.text) {
                try {
                  const bytes = AES.decrypt(message.text, "TI+q6GFY/6RgTyziRShd+rAdqvNAptOY9Dwv6V4rkROYva668zkfGGUKUUlDeuaB");
                  caption = bytes.toString(enc.Utf8);
                } catch (error) {
                  console.error("Caption decryption error:", error);
                }
              }
              
              photos.push({
                url: message.img,
                caption,
                timestamp: message.createdAt,
                senderId: message.senderId
              });
            }
            if (message.file) {
              files.push({
                url: message.file,
                name: message.fileName,
                timestamp: message.createdAt,
                senderId: message.senderId
              });
            }
          });
          
          setSharedMedia({
            photos: photos.sort((a, b) => b.timestamp - a.timestamp),
            files: files.sort((a, b) => b.timestamp - a.timestamp)
          });
        }
      } catch (error) {
        console.error("Error fetching shared media:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSharedMedia();
  }, [chatId]);

  useEffect(() => {
    if (!user?.id) return;
    
    const userStatusRef = doc(db, "users", user.id);
    const unsubscribe = onSnapshot(userStatusRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setUserStatus({
          lastSeen: data.lastSeen,
          isOnline: data.isOnline
        });
      }
    });
    
    return () => unsubscribe();
  }, [user?.id]);

  const toggleSection = (section) => {
    setSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleBlock = async () => {
    if (!user) return;

    try {
      const userDocRef = doc(db, "users", currentUser.id);
      await updateDoc(userDocRef, {
        blocked: isReceiverBlocked ? arrayRemove(user.id) : arrayUnion(user.id),
      });
      changeBlock();
    } catch (err) {
      console.error("Error updating block status:", err);
    }
  };

  const handleDownload = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  return (
    <div className="detail">
      <div className="user">
        <img 
          src={user?.avatar || "./avatar.png"} 
          alt="" 
          onError={(e) => {
            e.target.src = "./avatar.png";
          }}
        />
        <h2>{user?.username}</h2>
        {/* <p className="status">
          {userStatus.isOnline ? "Online" : userStatus.lastSeen 
            ? `Last seen ${formatDate(userStatus.lastSeen)}`
            : "Offline"}
        </p> */}
      </div>
      
      <div className="info">
        <div className="option">
          <div 
            className="title" 
            onClick={() => toggleSection('privacySettings')}
          >
            <span>Privacy & Settings</span>
            <img 
              src={sections.privacySettings ? "./arrowUp.png" : "./arrowDown.png"} 
              alt="" 
            />
          </div>
          {sections.privacySettings && (
            <div className="privacy-content">
              <button onClick={handleBlock} className="block-button">
                {isCurrentUserBlocked
                  ? "You are Blocked!"
                  : isReceiverBlocked
                  ? "Unblock User"
                  : "Block User"}
              </button>
              <button onClick={handleRemoveFriend} className="remove-friend-button">
                Remove Friend
              </button>
              <button onClick={handleChangePassword} className="change-password-button">
                Change Password
              </button>
              <button onClick={handleChangeProfilePicture} className="change-profile-picture-button">
                Change Profile Picture
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Detail;