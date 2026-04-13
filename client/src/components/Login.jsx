import React, { useState } from "react";
import { useLoginUserMutation, useRegisterUserMutation } from "../store/api";

const Login = ({ onLogin }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [loginUser, { isLoading: isLoginLoading }] = useLoginUserMutation();
  const [registerUser, { isLoading: isRegisterLoading }] =
    useRegisterUserMutation();

  const isLoading = isLoginLoading || isRegisterLoading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (isLoginMode) {
      if (!email.trim() || !password.trim()) {
        setErrorMsg("Email and password are required");
        return;
      }
    } else {
      if (!username.trim() || !email.trim() || !password.trim()) {
        setErrorMsg("Username, email, and password are required");
        return;
      }
    }

    try {
      if (isLoginMode) {
        const user = await loginUser({
          email: email.trim(),
          password,
        }).unwrap();
        onLogin(user);
      } else {
        await registerUser({ username: username.trim(), email: email.trim(), password }).unwrap();
        setIsLoginMode(true);
        setPassword("");
        setSuccessMsg("Registration successful! Please login.");
      }
    } catch (err) {
      console.error("Authentication failed:", err);
      setErrorMsg(err.data?.error || "An error occurred during authentication");
    }
  };

  return (
    <div className="glass-container login-card">
      <h1>Global Chat</h1>
      <p>
        {isLoginMode
          ? "Enter your credentials to join the conversation"
          : "Create an account to start chatting"}
      </p>

      {errorMsg && (
        <div
          style={{
            color: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            padding: "10px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "0.9rem",
          }}
        >
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            color: "var(--success)",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            padding: "10px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "0.9rem",
          }}
        >
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {!isLoginMode && (
          <div className="input-group">
            <label>Username (Display Name)</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alex_sky"
              autoFocus={!isLoginMode}
            />
          </div>
        )}

        <div className="input-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. alex@example.com"
            autoFocus={isLoginMode}
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button type="submit" disabled={isLoading}>
          {isLoading ? "Processing..." : isLoginMode ? "Login" : "Register"}
        </button>
      </form>

      <div
        style={{
          marginTop: "20px",
          fontSize: "0.9rem",
          color: "var(--text-muted)",
        }}
      >
        {isLoginMode ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => {
            setIsLoginMode(!isLoginMode);
            setErrorMsg("");
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "var(--primary)",
            cursor: "pointer",
            width: "auto",
            display: "inline",
            fontWeight: 600,
          }}
        >
          {isLoginMode ? "Register" : "Login"}
        </button>
      </div>
    </div>
  );
};

export default Login;
