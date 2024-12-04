import { useState, useEffect } from "react";
import "./login.css";
import { toast } from "react-toastify";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, setDoc, collection, query, where, getDocs, getDoc } from "firebase/firestore";
import upload from "../../lib/upload";
import QRCode from 'react-qr-code';
import * as OTPAuth from 'otpauth';

const Login = () => {
  const [avatar, setAvatar] = useState({ file: null, url: "" });
  const [loading, setLoading] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0 && registrationComplete) {
      setShowLoginMessage(true);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown, registrationComplete]);

  const generateSecret = () => {
    const secret = new OTPAuth.Secret();
    return secret.base32;
  };

  const verifyTOTP = (token, secret) => {
    try {
      const totp = new OTPAuth.TOTP({
        issuer: "SafeChatHub",
        algorithm: "SHA1",
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

  const handleAvatar = (e) => {
    if (e.target.files[0]) {
      setAvatar({
        file: e.target.files[0],
        url: URL.createObjectURL(e.target.files[0]),
      });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target);
    const { username, email, password } = Object.fromEntries(formData);

    if (!username.trim() || username.length < 3) {
      toast.warn("Username must be at least 3 characters!");
      setLoading(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.warn("Invalid email format!");
      setLoading(false);
      return;
    }

    if (!/^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/.test(password)) {
      toast.warn(
        "Password must be at least 6 characters, include one uppercase letter, and one number!"
      );
      setLoading(false);
      return;
    }

    if (!avatar.file) {
      toast.warn("Please upload an avatar!");
      setLoading(false);
      return;
    }

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        toast.warn("Username is already taken! Please choose another.");
        setLoading(false);
        return;
      }

      const res = await createUserWithEmailAndPassword(auth, email, password);
      const secret = generateSecret();
      const imgUrl = await upload(avatar.file);

      await setDoc(doc(db, "users", res.user.uid), {
        username,
        email,
        avatar: imgUrl,
        id: res.user.uid,
        blocked: [],
        secret,
      });

      const totp = new OTPAuth.TOTP({
        issuer: "SafeChatHub",
        label: username,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: secret
      });

      setQrValue(totp.toString());
      
      // Sign out the user after successful registration
      await auth.signOut();
      
      toast.success("Account created successfully! Please scan the QR code and set up 2FA.");
      setRegistrationComplete(true);
      setCountdown(60);
    } catch (err) {
      console.error("Registration error:", err);
      toast.error(err.message || "An error occurred during registration.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target);
    const { email, password } = Object.fromEntries(formData);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.warn("Please enter a valid email!");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.warn("Password must be at least 6 characters!");
      setLoading(false);
      return;
    }

    if (!twoFACode || twoFACode.length !== 6 || !/^\d{6}$/.test(twoFACode)) {
      toast.warn("Please enter a valid 6-digit 2FA code!");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      const userData = userDoc.data();

      if (!userData || !userData.secret) {
        await auth.signOut();
        throw new Error("User data or 2FA secret not found. Please contact support.");
      }

      const isValidToken = verifyTOTP(twoFACode, userData.secret);
      
      if (!isValidToken) {
        await auth.signOut();
        throw new Error("Invalid 2FA code. Please try again.");
      }

      toast.success("Logged in successfully!");
      window.location.reload();
    } catch (err) {
      console.error("Login error:", err);
      try {
        await auth.signOut();
      } catch (signOutError) {
        console.error("Sign out error:", signOutError);
      }
      toast.error(err.message || "An error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="form-wrapper">
        <div className="item">
          <h2>Welcome Back!</h2>
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="Email" name="email" required />
            <input type="password" placeholder="Password" name="password" required />
            <input
              type="text"
              placeholder="2FA Code"
              name="twoFA"
              value={twoFACode}
              onChange={(e) => setTwoFACode(e.target.value)}
              maxLength={6}
              pattern="\d{6}"
              required
            />
            <button disabled={loading}>{loading ? "Loading..." : "Sign In"}</button>
          </form>
        </div>

        <div className="separator"></div>

        <div className="item">
          <h2>Create an Account</h2>
          <form onSubmit={handleRegister}>
            <label htmlFor="file">
              <img src={avatar.url || "./avatar.png"} alt="avatar" />
              Upload an image
            </label>
            <input
              type="file"
              id="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatar}
            />
            <input type="text" placeholder="Username" name="username" required />
            <input type="email" placeholder="Email" name="email" required />
            <input type="password" placeholder="Password" name="password" required />
            <button disabled={loading}>{loading ? "Loading..." : "Sign Up"}</button>
          </form>
          {qrValue && (
            <div className="qr-container">
              <h3>Scan this QR Code with your Authenticator App:</h3>
              <QRCode value={qrValue} />
              {countdown > 0 && (
                <p className="text-center mt-4">
                  Please scan the QR code and set up 2FA. Time remaining: {countdown} seconds
                </p>
              )}
              {showLoginMessage && (
                <div className="mt-4 p-4 bg-blue-100 rounded">
                  <p className="text-center text-blue-800">
                    Registration complete! Please use the login form above with your credentials and 2FA code to sign in.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;