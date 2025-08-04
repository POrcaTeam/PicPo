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

  const fileId = Math.floor(Math.random() * 0xffffffff); // 生成随机 fileId
  dataChannel?.send(encodeBinaryFrame(0, fileId, undefined, fileName));

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
    dataChannel.send(
      encodeBinaryFrame(1, fileId, new Uint8Array(value.buffer))
    );
  }

  dataChannel.send(encodeBinaryFrame(2, fileId));
  console.debug("File transfer completed");
}

// 编码二进制帧
function encodeBinaryFrame(
  frameType: 0 | 1 | 2,
  fileId: number,
  payload?: Uint8Array,
  fileName?: string
): Uint8Array {
  const magic = 0xabcd;
  const payloadBytes = payload || new Uint8Array(0);
  const fileNameBytes = fileName
    ? new TextEncoder().encode(fileName)
    : new Uint8Array(0);

  const headerLength = 2 + 1 + 4 + 1 + 4 + fileNameBytes.length;
  const totalLength = headerLength + payloadBytes.length;

  const buffer = new Uint8Array(totalLength);
  const view = new DataView(buffer.buffer);

  let offset = 0;
  view.setUint16(offset, magic, true);
  offset += 2;

  view.setUint8(offset, frameType);
  offset += 1;

  view.setUint32(offset, fileId, true);
  offset += 4;

  view.setUint8(offset, fileNameBytes.length);
  offset += 1;

  view.setUint32(offset, payloadBytes.length, true);
  offset += 4;

  buffer.set(fileNameBytes, offset);
  offset += fileNameBytes.length;

  buffer.set(payloadBytes, offset);

  return buffer;
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
