const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const INTERNAL_ONLY = process.env.INTERNAL_ONLY === "true";

const imageFolderName = "mau-ao-hoi-thao";
const fallbackImageFolderName = "mẫu áo hội thao";
const imageDir = path.join(__dirname, fallbackImageFolderName);
const dataDir = path.join(__dirname, "data");
const voteStorePath = path.join(dataDir, "votes.json");
const votes = new Map();
const ipVotes = new Map();
let persistQueue = Promise.resolve();

function normalizeIp(ip) {
  if (!ip) return "";
  if (ip === "::1") return "127.0.0.1";
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function isPrivateIpv4(ip) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;

  const [a, b] = ip.split(".").map(Number);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;

  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 127)
  );
}

function isInternalIp(ip) {
  if (!ip) return false;
  if (ip === "127.0.0.1") return true;
  if (isPrivateIpv4(ip)) return true;

  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;

  return false;
}

async function persistVotesToDisk() {
  const voteObject = Object.fromEntries(votes.entries());
  const ipVoteObject = Object.fromEntries(ipVotes.entries());
  const payload = {
    updatedAt: new Date().toISOString(),
    votes: voteObject,
    ipVotes: ipVoteObject,
  };

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(voteStorePath, JSON.stringify(payload, null, 2), "utf8");
}

function queuePersistVotes() {
  persistQueue = persistQueue
    .then(() => persistVotesToDisk())
    .catch(() => persistVotesToDisk());

  return persistQueue;
}

async function loadVotesFromDisk() {
  try {
    const raw = await fs.readFile(voteStorePath, "utf8");
    const data = JSON.parse(raw);
    const storedVotes = data && typeof data === "object" ? data.votes : null;
    const storedIpVotes = data && typeof data === "object" ? data.ipVotes : null;

    if (!storedVotes || typeof storedVotes !== "object") {
      return;
    }

    Object.entries(storedVotes).forEach(([imageId, count]) => {
      const numberCount = Number(count);
      if (Number.isInteger(numberCount) && numberCount >= 0) {
        votes.set(imageId, numberCount);
      }
    });

    if (storedIpVotes && typeof storedIpVotes === "object") {
      Object.entries(storedIpVotes).forEach(([ip, imageId]) => {
        if (typeof imageId === "string" && imageId.length > 0) {
          ipVotes.set(ip, imageId);
        }
      });
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Khong the nap du lieu binh chon:", error.message);
    }
  }
}

function getClientIp(req) {
  return normalizeIp(req.ip);
}

function getTotalVotes() {
  return Array.from(votes.values()).reduce((sum, count) => sum + count, 0);
}

function getTopVoted(images) {
  const leaderboard = images
    .map((fileName) => ({
      id: fileName,
      name: fileName,
      url: `/${imageFolderName}/${encodeURIComponent(fileName)}`,
      votes: votes.get(fileName) || 0,
    }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "vi"));

  const top = leaderboard[0] || null;
  const winners = top && top.votes > 0
    ? leaderboard.filter((item) => item.votes === top.votes)
    : [];

  return { top, winners };
}

function isImageFile(fileName) {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
}

async function getImageFiles() {
  const entries = await fs.readdir(imageDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && isImageFile(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "vi"));
}

app.use(express.json());

if (INTERNAL_ONLY) {
  app.use((req, res, next) => {
    const clientIp = normalizeIp(req.ip);
    if (!isInternalIp(clientIp)) {
      return res.status(403).json({ message: "Chi cho phep truy cap noi bo." });
    }

    return next();
  });
}

app.use(express.static(path.join(__dirname, "public")));
app.use(`/${imageFolderName}`, express.static(imageDir));

app.get("/api/images", async (req, res) => {
  try {
    const files = await getImageFiles();
    const images = files.map((fileName) => ({
      id: fileName,
      name: fileName,
      url: `/${imageFolderName}/${encodeURIComponent(fileName)}`,
      votes: votes.get(fileName) || 0,
    }));

    const clientIp = getClientIp(req);
    const myVoteImageId = ipVotes.get(clientIp) || null;

    res.json({
      images,
      myVoteImageId,
      totalVotes: getTotalVotes(),
    });
  } catch (error) {
    res.status(500).json({
      message: "Khong the doc thu muc hinh anh.",
      detail: error.message,
    });
  }
});

app.post("/api/vote", async (req, res) => {
  const { imageId } = req.body || {};

  if (!imageId || typeof imageId !== "string") {
    return res.status(400).json({ message: "imageId khong hop le." });
  }

  try {
    const files = await getImageFiles();
    if (!files.includes(imageId)) {
      return res.status(404).json({ message: "Khong tim thay mau ao." });
    }

    const clientIp = getClientIp(req);
    const currentIpVote = ipVotes.get(clientIp);

    if (currentIpVote && currentIpVote !== imageId) {
      return res.status(409).json({
        message: "IP nay da binh chon mau khac. Hay bo binh chon truoc.",
        myVoteImageId: currentIpVote,
      });
    }

    if (currentIpVote === imageId) {
      return res.json({
        imageId,
        votes: votes.get(imageId) || 0,
        myVoteImageId: imageId,
        totalVotes: getTotalVotes(),
      });
    }

    const currentVote = votes.get(imageId) || 0;
    votes.set(imageId, currentVote + 1);
    ipVotes.set(clientIp, imageId);
    await queuePersistVotes();

    return res.json({
      imageId,
      votes: votes.get(imageId),
      myVoteImageId: imageId,
      totalVotes: getTotalVotes(),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Khong the binh chon luc nay.",
      detail: error.message,
    });
  }
});

app.delete("/api/vote", async (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const currentIpVote = ipVotes.get(clientIp);

    if (!currentIpVote) {
      return res.status(400).json({ message: "IP nay chua binh chon mau nao." });
    }

    const currentVote = votes.get(currentIpVote) || 0;
    const nextVote = Math.max(0, currentVote - 1);
    votes.set(currentIpVote, nextVote);
    ipVotes.delete(clientIp);
    await queuePersistVotes();

    return res.json({
      removedImageId: currentIpVote,
      votes: nextVote,
      myVoteImageId: null,
      totalVotes: getTotalVotes(),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Khong the bo binh chon luc nay.",
      detail: error.message,
    });
  }
});

app.get("/api/top-voted", async (req, res) => {
  try {
    const files = await getImageFiles();
    const { top, winners } = getTopVoted(files);
    const clientIp = getClientIp(req);
    const myVoteImageId = ipVotes.get(clientIp) || null;

    res.json({
      top,
      winners,
      totalVotes: getTotalVotes(),
      myVoteImageId,
    });
  } catch (error) {
    res.status(500).json({
      message: "Khong the lay ket qua binh chon.",
      detail: error.message,
    });
  }
});

async function startServer() {
  await loadVotesFromDisk();

  app.listen(PORT, HOST, () => {
    console.log(`App dang chay tai http://${HOST}:${PORT}`);
    if (INTERNAL_ONLY) {
      console.log("Che do noi bo: CHI chap nhan dia chi mang private/LAN.");
    } else {
      console.log("Che do mo: cho phep truy cap tu moi dia chi IP.");
    }
    console.log(`Du lieu binh chon luu tai: ${voteStorePath}`);
  });
}

startServer().catch((error) => {
  console.error("Khoi dong that bai:", error.message);
  process.exit(1);
});
