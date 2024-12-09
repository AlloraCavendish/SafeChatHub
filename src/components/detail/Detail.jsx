import { useState, useEffect } from "react";
import { arrayRemove, arrayUnion, doc, updateDoc, getDoc } from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";
import { useChatStore } from "../../lib/chatStore";
import { auth, db } from "../../lib/firebase";
import { useUserStore } from "../../lib/userStore";
import "./detail.css";
import { AES, enc } from "crypto-js";

const Detail = () => {
  const { chatId, user, isCurrentUserBlocked, isReceiverBlocked, changeBlock, resetChat } =
    useChatStore();
  const { currentUser } = useUserStore();
  
  const [sections, setSections] = useState({
    chatSettings: false,
    privacyHelp: false,
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

  // Fetch shared media from chat history
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
              // Decrypt image caption if exists
              let caption = "";
              if (message.text) {
                try {
                  const bytes = AES.decrypt(message.text, "secretKey");
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

  // Monitor user status
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
        {/* <div className="option">
          <div 
            className="title" 
            onClick={() => toggleSection('chatSettings')}
          >
            <span>Chat Settings</span>
            <img 
              src={sections.chatSettings ? "./arrowUp.png" : "./arrowDown.png"} 
              alt="" 
            />
          </div>
          {sections.chatSettings && (
            <div className="settings-content">
              <div className="setting-item">
                <span>Notifications</span>
                <input type="checkbox" />
              </div>
              <div className="setting-item">
                <span>Chat Theme</span>
                <select>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
          )}
        </div> */}

        <div className="option">
          <div 
            className="title" 
            onClick={() => toggleSection('privacyHelp')}
          >
            <span>Privacy & Help</span>
            <img 
              src={sections.privacyHelp ? "./arrowUp.png" : "./arrowDown.png"} 
              alt="" 
            />
          </div>
          {sections.privacyHelp && (
            <div className="privacy-content">
              <button onClick={handleBlock} className="block-button">
                {isCurrentUserBlocked
                  ? "You are Blocked!"
                  : isReceiverBlocked
                  ? "Unblock User"
                  : "Block User"}
              </button>
            </div>
          )}
        </div>

        <div className="option">
          <div 
            className="title" 
            onClick={() => toggleSection('sharedPhotos')}
          >
            <span>Shared Photos</span>
            <img 
              src={sections.sharedPhotos ? "./arrowUp.png" : "./arrowDown.png"} 
              alt="" 
            />
          </div>
          {sections.sharedPhotos && (
            <div className="photos">
              {loading ? (
                <p>Loading shared photos...</p>
              ) : sharedMedia.photos.length > 0 ? (
                sharedMedia.photos.map((photo, index) => (
                  <div className="photoItem" key={index}>
                    <div className="photoDetail">
                      <img src={photo.url} alt="" />
                      <span>{photo.caption || `Photo ${formatDate(photo.timestamp)}`}</span>
                    </div>
                    <img
                      src="./download.png"
                      alt="Download"
                      className="icon"
                      onClick={() => handleDownload(photo.url, `photo_${index}.jpg`)}
                    />
                  </div>
                ))
              ) : (
                <p>No shared photos</p>
              )}
            </div>
          )}
        </div>

        <div className="option">
          <div 
            className="title" 
            onClick={() => toggleSection('sharedFiles')}
          >
            <span>Shared Files</span>
            <img 
              src={sections.sharedFiles ? "./arrowUp.png" : "./arrowDown.png"} 
              alt="" 
            />
          </div>
          {sections.sharedFiles && (
            <div className="files">
              {loading ? (
                <p>Loading shared files...</p>
              ) : sharedMedia.files.length > 0 ? (
                sharedMedia.files.map((file, index) => (
                  <div className="fileItem" key={index}>
                    <div className="fileDetail">
                      <img src="./file.png" alt="" />
                      <span>{file.name || `File ${formatDate(file.timestamp)}`}</span>
                    </div>
                    <img
                      src="./download.png"
                      alt="Download"
                      className="icon"
                      onClick={() => handleDownload(file.url, file.name)}
                    />
                  </div>
                ))
              ) : (
                <p>No shared files</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Detail;