require("dotenv").config();
const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const INTERNAL_ONLY = process.env.INTERNAL_ONLY === "true";

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Thiếu SUPABASE_URL hoặc SUPABASE_ANON_KEY trong .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const imageFolderName = "mau-ao-hoi-thao";
const fallbackImageFolderName = "mẫu áo hội thao";
const imageDir = path.join(__dirname, fallbackImageFolderName);

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

function getClientIp(req) {
  return normalizeIp(req.ip);
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

async function getVoteStats() {
  const { data, error } = await supabase
    .from("votes")
    .select("image_id");

  if (error) {
    console.error("Lỗi lấy vote stats:", error);
    return {};
  }

  const stats = {};
  if (data) {
    data.forEach((row) => {
      stats[row.image_id] = (stats[row.image_id] || 0) + 1;
    });
  }
  return stats;
}

async function getTotalVotes() {
  const { data, error } = await supabase
    .from("votes")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Lỗi tính tổng vote:", error);
    return 0;
  }

  return data ? (Array.isArray(data) ? data.length : 0) : 0;
}

async function getTopVoted(images) {
  const voteStats = await getVoteStats();

  const leaderboard = images
    .map((fileName) => ({
      id: fileName,
      name: fileName,
      url: `/${imageFolderName}/${encodeURIComponent(fileName)}`,
      votes: voteStats[fileName] || 0,
    }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "vi"));

  const top = leaderboard[0] || null;
  const winners =
    top && top.votes > 0
      ? leaderboard.filter((item) => item.votes === top.votes)
      : [];

  return { top, winners };
}

app.use(express.json());

if (INTERNAL_ONLY) {
  app.use((req, res, next) => {
    const clientIp = normalizeIp(req.ip);
    if (!isInternalIp(clientIp)) {
      return res.status(403).json({ message: "Chỉ cho phép truy cập nội bộ." });
    }

    return next();
  });
}

app.use(express.static(path.join(__dirname, "public")));
app.use(`/${imageFolderName}`, express.static(imageDir));

app.get("/api/images", async (req, res) => {
  try {
    const files = await getImageFiles();
    const voteStats = await getVoteStats();
    const totalVotes = await getTotalVotes();

    const images = files.map((fileName) => ({
      id: fileName,
      name: fileName,
      url: `/${imageFolderName}/${encodeURIComponent(fileName)}`,
      votes: voteStats[fileName] || 0,
    }));

    const clientIp = getClientIp(req);

    // Lấy vote hiện tại của IP này
    const { data: myVote } = await supabase
      .from("votes")
      .select("image_id")
      .eq("ip_address", clientIp)
      .single();

    const myVoteImageId = myVote ? myVote.image_id : null;

    res.json({
      images,
      myVoteImageId,
      totalVotes,
    });
  } catch (error) {
    res.status(500).json({
      message: "Không thể đọc thư mục hình ảnh.",
      detail: error.message,
    });
  }
});

app.post("/api/vote", async (req, res) => {
  const { imageId } = req.body || {};

  if (!imageId || typeof imageId !== "string") {
    return res.status(400).json({ message: "imageId không hợp lệ." });
  }

  try {
    const files = await getImageFiles();
    if (!files.includes(imageId)) {
      return res.status(404).json({ message: "Không tìm thấy mẫu áo." });
    }

    const clientIp = getClientIp(req);

    // Kiểm tra IP đã bình chọn chưa
    const { data: existingVote } = await supabase
      .from("votes")
      .select("image_id")
      .eq("ip_address", clientIp)
      .single();

    if (existingVote && existingVote.image_id !== imageId) {
      return res.status(409).json({
        message:
          "IP này đã bình chọn mẫu khác. Hãy bỏ bình chọn trước.",
        myVoteImageId: existingVote.image_id,
      });
    }

    if (existingVote && existingVote.image_id === imageId) {
      const voteStats = await getVoteStats();
      return res.json({
        imageId,
        votes: voteStats[imageId] || 0,
        myVoteImageId: imageId,
        totalVotes: await getTotalVotes(),
      });
    }

    // Thêm vote mới
    const { error } = await supabase.from("votes").insert([
      {
        image_id: imageId,
        ip_address: clientIp,
      },
    ]);

    if (error) {
      throw error;
    }

    const voteStats = await getVoteStats();
    return res.json({
      imageId,
      votes: voteStats[imageId] || 0,
      myVoteImageId: imageId,
      totalVotes: await getTotalVotes(),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Không thể bình chọn lúc này.",
      detail: error.message,
    });
  }
});

app.delete("/api/vote", async (req, res) => {
  try {
    const clientIp = getClientIp(req);

    // Tìm vote hiện tại của IP
    const { data: currentVote } = await supabase
      .from("votes")
      .select("image_id")
      .eq("ip_address", clientIp)
      .single();

    if (!currentVote) {
      return res.status(400).json({
        message: "IP này chưa bình chọn mẫu nào.",
      });
    }

    // Xóa vote
    const { error } = await supabase
      .from("votes")
      .delete()
      .eq("ip_address", clientIp);

    if (error) {
      throw error;
    }

    res.json({
      removedImageId: currentVote.image_id,
      myVoteImageId: null,
      totalVotes: await getTotalVotes(),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Không thể bỏ bình chọn lúc này.",
      detail: error.message,
    });
  }
});

app.get("/api/top-voted", async (req, res) => {
  try {
    const files = await getImageFiles();
    const { top, winners } = await getTopVoted(files);
    const clientIp = getClientIp(req);

    // Lấy vote hiện tại của IP
    const { data: myVote } = await supabase
      .from("votes")
      .select("image_id")
      .eq("ip_address", clientIp)
      .single();

    const myVoteImageId = myVote ? myVote.image_id : null;

    res.json({
      top,
      winners,
      totalVotes: await getTotalVotes(),
      myVoteImageId,
    });
  } catch (error) {
    res.status(500).json({
      message: "Không thể lấy kết quả bình chọn.",
      detail: error.message,
    });
  }
});

async function startServer() {
  app.listen(PORT, HOST, () => {
    console.log(`✓ App đang chạy tại http://${HOST}:${PORT}`);
    if (INTERNAL_ONLY) {
      console.log("🔒 Chế độ nội bộ: CHỈ chấp nhận địa chỉ mạng private/LAN.");
    } else {
      console.log("🌐 Chế độ mở: cho phép truy cập từ mọi địa chỉ IP.");
    }
    console.log(`📊 Dữ liệu bình chọn: Supabase PostgreSQL`);
  });
}

startServer().catch((error) => {
  console.error("Lỗi khởi động server:", error);
  process.exit(1);
});
