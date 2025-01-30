import { auth, db } from "./firebase";
import { doc, query, collection, where, getDocs, updateDoc } from "firebase/firestore";
import * as OTPAuth from "otpauth";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";

const verifyTOTP = (token, secret) => {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: "SafeChatHub",
      algorithm: "SHA256",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const delta = totp.validate({ token, window: 3 });
    return delta !== null;
  } catch (error) {
    console.error("TOTP verification error:", error);
    return false;
  }
};

export const validateEmail = async (email) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please enter a valid email address.");
  }

  const usersRef = collection(db, "users");
  const q = query(usersRef, where("email", "==", email));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error("Email address not registered. Please check and try again.");
  }

  return querySnapshot.docs[0];
};

export const handleForgotPassword = async (email, twoFACode, newPassword) => {
  try {
    const userDoc = await validateEmail(email);
    const userData = userDoc.data();

    if (!twoFACode || twoFACode.length !== 6 || !/^\d{6}$/.test(twoFACode)) {
      throw new Error("Please enter a valid 6-digit 2FA code.");
    }

    if (!userData.secret) {
      throw new Error("2FA is not configured for this account. Please contact system administrator.");
    }

    const isValidToken = verifyTOTP(twoFACode, userData.secret);
    if (!isValidToken) {
      throw new Error("Invalid 2FA code. Please try again.");
    }

    const auth = getAuth();
    await sendPasswordResetEmail(auth, email);

    return "Password reset email sent. Please check your inbox to reset your password.";
  } catch (error) {
    console.error("Forgot Password error:", error);
    throw new Error(error.message || "An error occurred while processing your request.");
  }
};
