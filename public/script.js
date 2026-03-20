const galleryEl = document.getElementById("gallery");
const selectedCountEl = document.getElementById("selected-count");
const selectedPreviewEl = document.getElementById("selected-preview");
const totalVotesEl = document.getElementById("total-votes");
const voteStatusEl = document.getElementById("vote-status");
const myVotePreviewEl = document.getElementById("my-vote-preview");
const topResultEl = document.getElementById("top-result");
const cardTemplate = document.getElementById("card-template");

let images = [];
const selectedIds = new Set();
let myVoteImageId = null;

function getVoterId() {
  const key = "voter_id";
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const created =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `voter_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  localStorage.setItem(key, created);
  return created;
}

function getApiHeaders(includeJson = false) {
  const headers = {
    "X-Voter-Id": getVoterId(),
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function truncateName(name) {
  return name.length > 32 ? `${name.slice(0, 32)}...` : name;
}

function getDisplayName(item) {
  return item.displayName || item.name;
}

function updateSelectedPreview() {
  selectedCountEl.textContent = selectedIds.size;

  if (!selectedIds.size) {
    selectedPreviewEl.classList.add("empty");
    selectedPreviewEl.textContent = "Chua chon mau nao";
    return;
  }

  selectedPreviewEl.classList.remove("empty");
  selectedPreviewEl.innerHTML = "";

  images
    .filter((item) => selectedIds.has(item.id))
    .forEach((item) => {
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      thumb.title = getDisplayName(item);

      const image = document.createElement("img");
      image.src = item.url;
      image.alt = getDisplayName(item);
      thumb.appendChild(image);

      selectedPreviewEl.appendChild(thumb);
    });
}

function toggleSelect(imageId) {
  if (selectedIds.has(imageId)) {
    selectedIds.delete(imageId);
  } else {
    selectedIds.add(imageId);
  }

  updateSelectedPreview();
  renderGallery();
}

function updateVoteStatus() {
  totalVotesEl.textContent = images.reduce((sum, item) => sum + (item.votes || 0), 0);

  if (!myVoteImageId) {
    voteStatusEl.textContent = "Ban chua binh chon mau nao.";
    myVotePreviewEl.classList.add("empty");
    myVotePreviewEl.textContent = "Chua co mau nao duoc binh chon boi IP nay.";
    return;
  }

  const votedImage = images.find((item) => item.id === myVoteImageId);
  if (!votedImage) {
    voteStatusEl.textContent = "Ban chua binh chon mau nao.";
    myVotePreviewEl.classList.add("empty");
    myVotePreviewEl.textContent = "Chua co mau nao duoc binh chon boi IP nay.";
    return;
  }

  voteStatusEl.textContent = `Ban dang binh chon: ${truncateName(getDisplayName(votedImage))}.`;
  myVotePreviewEl.classList.remove("empty");
  myVotePreviewEl.innerHTML = `
    <img class="my-vote-image" src="${votedImage.url}" alt="${getDisplayName(votedImage)}" />
    <div class="my-vote-meta">
      <p class="my-vote-tag">Mau cua IP hien tai</p>
      <p class="my-vote-name">${truncateName(getDisplayName(votedImage))}</p>
    </div>
  `;
}

function updateTopResult() {
  if (!images.length) {
    topResultEl.textContent = "Chua co du lieu mau ao.";
    return;
  }

  const sorted = [...images].sort(
    (a, b) => (b.votes || 0) - (a.votes || 0) || a.name.localeCompare(b.name, "vi")
  );
  const top = sorted[0];
  const topVotes = top.votes || 0;

  if (topVotes === 0) {
    topResultEl.textContent = "Chua co luot binh chon nao.";
    return;
  }

  const winners = sorted.filter((item) => (item.votes || 0) === topVotes);
  const winnersText =
    winners.length > 1
      ? `Dang dong hang voi ${winners.length} mau (${topVotes} luot)`
      : `Dang dan dau voi ${topVotes} luot`;

  topResultEl.innerHTML = `
    <img class="winner-image" src="${top.url}" alt="${getDisplayName(top)}" />
    <div>
      <strong>${truncateName(getDisplayName(top))}</strong>
      <p>${winnersText}</p>
    </div>
  `;
}

async function voteImage(imageId) {
  const response = await fetch("/api/vote", {
    method: "POST",
    headers: getApiHeaders(true),
    body: JSON.stringify({ imageId }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || "Binh chon that bai.");
  }

  const target = images.find((item) => item.id === payload.imageId);
  if (target) {
    target.votes = payload.votes;
  }

  myVoteImageId = payload.myVoteImageId || null;
}

async function unvoteImage() {
  const response = await fetch("/api/vote", {
    method: "DELETE",
    headers: getApiHeaders(),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || "Bo binh chon that bai.");
  }

  const target = images.find((item) => item.id === payload.removedImageId);
  if (target) {
    target.votes = payload.votes;
  }

  myVoteImageId = null;
}

function renderGallery() {
  galleryEl.innerHTML = "";

  images.forEach((item) => {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector(".card");
    const imageBtn = node.querySelector(".image-btn");
    const image = node.querySelector("img");
    const name = node.querySelector(".name");
    const voteBtn = node.querySelector(".vote-btn");
    const voteCount = node.querySelector(".vote-count");

    image.src = item.url;
    image.alt = getDisplayName(item);
    name.textContent = getDisplayName(item);
    voteCount.textContent = `${item.votes || 0} luot`;

    if (selectedIds.has(item.id)) {
      card.classList.add("selected");
    }

    const isCurrentVoted = myVoteImageId === item.id;
    const isLockedByAnotherVote = Boolean(myVoteImageId && myVoteImageId !== item.id);

    if (isCurrentVoted) {
      voteBtn.textContent = "Bo binh chon";
    } else if (isLockedByAnotherVote) {
      voteBtn.textContent = "Da khoa";
      voteBtn.disabled = true;
    } else {
      voteBtn.textContent = "Binh chon";
    }

    imageBtn.addEventListener("click", () => toggleSelect(item.id));

    voteBtn.addEventListener("click", async () => {
      voteBtn.disabled = true;
      const originalText = voteBtn.textContent;
      voteBtn.textContent = "Dang xu ly...";

      try {
        if (myVoteImageId === item.id) {
          await unvoteImage();
        } else {
          await voteImage(item.id);
        }
      } catch (error) {
        alert(error.message);
      } finally {
        renderGallery();
        updateVoteStatus();
        updateTopResult();
        voteBtn.disabled = false;
        voteBtn.textContent = originalText;
      }
    });

    galleryEl.appendChild(node);
  });
}

async function init() {
  const response = await fetch("/api/images", {
    headers: getApiHeaders(),
  });
  if (!response.ok) {
    throw new Error("Khong the tai danh sach hinh anh.");
  }

  const data = await response.json();
  images = data.images.map((item, index) => ({
    ...item,
    displayName: `Mau ${index + 1}`,
  }));
  myVoteImageId = data.myVoteImageId || null;
  renderGallery();
  updateSelectedPreview();
  updateVoteStatus();
  updateTopResult();
}

init().catch((error) => {
  galleryEl.innerHTML = `<p>${error.message}</p>`;
});
