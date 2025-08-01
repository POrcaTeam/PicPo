// 创建webrtc Server
let peerConnection: RTCPeerConnection | null;
let dataChannel: RTCDataChannel | null;

export const startConnection = async () => {
  return new Promise<void>(async (resolve, reject) => {
    // {
    //   iceServers: [
    //     {
    //       urls: ["stun:stun.l.google.com:19302"],
    //     },
    //   ],
    // }
    peerConnection = new RTCPeerConnection();
    // 创建 Data Channel 并设置回调
    dataChannel = peerConnection.createDataChannel("chat");
    // peerConnection.oniceconnectionstatechange = (e) =>
    //   console.log(peerConnection.iceConnectionState);
    // 记住address作为client_key
    let address = generateRandomCode();
    // 监听 ICE 候选者，并发送到服务器
    peerConnection.onicecandidate = async (event) => {
      // 判断是否获得候选者信息,将信息发送到后台
      if (event.candidate) {
        try {
          await fetch(`http://127.0.0.1:17529/ice/${address}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(event.candidate.toJSON()),
          });
        } catch (e) {
          console.error("Failed to send ICE candidate:", e);
          reject(e);
        }
      }
    };

    dataChannel.onopen = () => {
      var readyState = dataChannel?.readyState;
      if (readyState == "open") {
        console.debug("Data channel open");
        resolve();
      }
    };
    dataChannel.onclose = () => {
      console.debug("Data channel closed");
      peerConnection?.close();
      peerConnection = null;
      dataChannel = null;
    };
    dataChannel.onerror = (event) => {
      console.error(event);
      reject(event);
    };
    dataChannel.onmessage = (event) => {
      const message = `Rust: ${event.data}`;
    };

    // 设置 Local Offer 并发送给服务器
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const response = await fetch(`http://127.0.0.1:17529/offer/${address}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(peerConnection.localDescription),
    });

    const answer = await response.json();
    await peerConnection.setRemoteDescription(answer);
  });
};

export function sendMessage(message: string) {
  if (peerConnection?.connectionState === "failed") {
    throw new Error("Connection failed, please restart the connection.");
  }
  console.debug(
    peerConnection?.remoteDescription,
    peerConnection?.localDescription
  );
  dataChannel?.send(message);
}

const CHUNK_SIZE = 16 * 1024; // 16KB
const BUFFER_THRESHOLD = 512 * 1024; // 512KB：触发 backpressure
const BUFFER_LOW_WATERMARK = 128 * 1024; // 128KB：继续发送

export async function sendFile(blob: Uint8Array, fileName: string) {
  if (!dataChannel) return;
  dataChannel?.send("INSERT_FILE(" + fileName + ")");

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let offset = 0;

      function push() {
        if (offset >= blob.length) {
          controller.close();
          return;
        }

        const end = Math.min(offset + CHUNK_SIZE, blob.length);
        const chunk = blob.slice(offset, end);
        controller.enqueue(chunk);
        offset = end;

        push();
      }

      push();
    },
  });

  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // ⏳ Backpressure：若缓冲区过大，等待其变小
    await waitForBufferedAmountLow(dataChannel);

    // 发送 chunk
    dataChannel.send(value.buffer as ArrayBuffer);
  }

  dataChannel.send("END_OF_FILE");
  console.debug("File transfer completed");
}

function waitForBufferedAmountLow(dc: RTCDataChannel): Promise<void> {
  if (dc.bufferedAmount < BUFFER_THRESHOLD) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const check = () => {
      if (dc.bufferedAmount < BUFFER_LOW_WATERMARK) {
        resolve();
      } else {
        // 每 100ms 检查一次（也可以用 requestAnimationFrame）
        setTimeout(check, 100);
      }
    };
    check();
  });
}

function generateRandomCode(length: number = 8): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    const rand = Math.floor(Math.random() * chars.length);
    result += chars[rand];
  }
  return result;
}
