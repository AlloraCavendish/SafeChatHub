import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * @param {string} userId
 */
export const changeProfilePicture = async (userId) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";

  return new Promise((resolve, reject) => {
    input.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return reject("No file selected.");

      const storage = getStorage();
      const storageRef = ref(storage, `profile_pictures/${userId}_${file.name}`);

      try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, {
          avatar: downloadURL,
        });

        console.log("Profile picture updated successfully!");
        resolve(downloadURL);
        window.location.reload();
      } catch (error) {
        console.error("Error changing profile picture:", error);
        reject(error);
      }
    });

    input.click();
  });
};
