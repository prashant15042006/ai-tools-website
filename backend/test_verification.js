import { spawn } from "child_process";
import fetch from "node-fetch";

async function runTest() {
  console.log("Starting backend server on port 5009 for verification...");
  
  const serverProcess = spawn("node", ["server.js"], {
    env: { ...process.env, PORT: "5009" }
  });

  // Log server output to see if it starts successfully
  serverProcess.stdout.on("data", (data) => {
    console.log(`[Server]: ${data.toString().trim()}`);
  });

  serverProcess.stderr.on("data", (data) => {
    console.error(`[Server Error]: ${data.toString().trim()}`);
  });

  // Wait 3 seconds for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log("Sending chat request to http://localhost:5009/api/chat...");
  try {
    const res = await fetch("http://localhost:5009/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Tell me a joke in one line.",
        userName: "VerificationTest"
      })
    });

    console.log("Response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Server returned error: ${res.status} - ${text}`);
    }

    let buffer = "";
    res.body.on("data", (chunk) => {
      const dataStr = chunk.toString();
      buffer += dataStr;
      console.log(`[Received Chunk]: ${dataStr.trim()}`);
    });

    await new Promise((resolve, reject) => {
      res.body.on("end", () => {
        console.log("Stream ended successfully.");
        resolve();
      });
      res.body.on("error", (err) => {
        reject(err);
      });
    });

    console.log("Full Response Buffer length:", buffer.length);
    if (buffer.includes("[DONE]") && buffer.includes("content")) {
      console.log("✅ VERIFICATION SUCCESSFUL! Backend fallback stream works correctly.");
    } else {
      console.error("❌ Verification failed. Response didn't contain expected format.");
    }
  } catch (err) {
    console.error("❌ Verification failed with error:", err.message);
  } finally {
    console.log("Stopping backend server...");
    serverProcess.kill();
  }
}

runTest();
