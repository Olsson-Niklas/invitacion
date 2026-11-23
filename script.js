const cardScene = document.querySelector(".card-scene");
const openButton = document.querySelector("#open-card");
const closeButton = document.querySelector("#close-card");
const inside = document.querySelector("#inside");
const backgroundMusic = document.querySelector("#background-music");
const invitationPage = document.querySelector("#invitation-page");
const menuPage = document.querySelector("#menu-page");
const menuTitle = document.querySelector("#menu-title");
const dishFeedback = document.querySelector("#dish-feedback");
const dishOptions = document.querySelectorAll('input[name="main-dish"]');
const dishForm = document.querySelector("#dish-form");
const submitDishButton = document.querySelector("#submit-dish");
const submissionEndpoint = "https://script.google.com/macros/s/AKfycbylv22R3F31yQnlDllRYIrlsG5yHehhl4GrlEJVNZU3-ABYSorwCThIJhZHLPeT6-f79w/exec";
const submissionStorageKey = "birthday-invitation-dish-submitted";
const voterIdStorageKey = "birthday-invitation-voter-id";
let hasSubmittedDish = localStorage.getItem(submissionStorageKey) === "submitted";
let isSubmittingDish = false;
let isStartingBackgroundMusic = false;
const backgroundMusicStartTime = 3;
const photoGroup = document.querySelector(".photo-number g");
const photoSources = Array.from(photoGroup.querySelectorAll("image"), (image) => image.getAttribute("href"));

function skipBackgroundMusicIntro() {
    if (
        Number.isFinite(backgroundMusic.duration)
        && backgroundMusic.duration > backgroundMusicStartTime
        && backgroundMusic.currentTime < backgroundMusicStartTime
    ) {
        backgroundMusic.currentTime = backgroundMusicStartTime;
    }
}

function startBackgroundMusic() {
    if (isStartingBackgroundMusic || !backgroundMusic.paused) {
        return;
    }

    isStartingBackgroundMusic = true;
    backgroundMusic.play()
        .then(() => {
            document.removeEventListener("pointerdown", startBackgroundMusic);
            document.removeEventListener("keydown", startBackgroundMusic);
        })
        .catch((error) => {
            if (error.name === "NotAllowedError") {
                document.addEventListener("pointerdown", startBackgroundMusic);
                document.addEventListener("keydown", startBackgroundMusic);
                return;
            }

            console.error("No se pudo reproducir la música de fondo.", error);
        })
        .finally(() => {
            isStartingBackgroundMusic = false;
        });
}

backgroundMusic.addEventListener("loadedmetadata", skipBackgroundMusicIntro);
backgroundMusic.addEventListener("ended", () => {
        backgroundMusic.currentTime = Number.isFinite(backgroundMusic.duration)
            && backgroundMusic.duration > backgroundMusicStartTime
            ? backgroundMusicStartTime
            : 0;
        startBackgroundMusic();
});
backgroundMusic.volume = 0.20;
skipBackgroundMusicIntro();
startBackgroundMusic();

photoGroup.replaceChildren();
const photoDefs = document.querySelector(".photo-number defs");
photoGroup.insertAdjacentHTML("afterbegin", '<rect width="680" height="350" fill="#eee5d9" />');

for (let index = 0; index < 18; index += 1) {
    const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
    const column = index % 6;
    const row = Math.floor(index / 6);
    const tileWidth = 680 / 6;
    const tileHeight = 350 / 3;
    const scale = row === 0 ? 1.18 : row === 2 ? 1.05 : 1;
    const bottomRowShift = column === 4 ? -10 : -18;
    const verticalShift = row === 0 ? 10 : row === 2 ? bottomRowShift : 0;
    const clipId = `photo-tile-${index}`;
    const tileClip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
    const tileBounds = document.createElementNS("http://www.w3.org/2000/svg", "rect");

    tileClip.setAttribute("id", clipId);
    tileBounds.setAttribute("x", String(column * tileWidth));
    tileBounds.setAttribute("y", String(row === 2 ? row * tileHeight - 18 : row === 0 ? 0 : row * tileHeight));
    tileBounds.setAttribute("width", String(tileWidth));
    tileBounds.setAttribute("height", String(row === 2 ? tileHeight + 18 : tileHeight));
    tileClip.append(tileBounds);
    photoDefs.append(tileClip);
    image.setAttribute("href", photoSources[index % photoSources.length]);
    image.setAttribute("x", String(column * tileWidth - (scale - 1) * tileWidth / 2));
    image.setAttribute("y", String(row * tileHeight - (scale - 1) * tileHeight / 2 + verticalShift));
    image.setAttribute("width", String(tileWidth * scale));
    image.setAttribute("height", String(tileHeight * scale));
    image.setAttribute("preserveAspectRatio", "xMidYMid slice");
    image.setAttribute("clip-path", `url(#${clipId})`);
    photoGroup.append(image);
}

function setCardOpen(isOpen) {
    cardScene.classList.toggle("is-open", isOpen);
    openButton.setAttribute("aria-expanded", String(isOpen));
    inside.inert = !isOpen;

    if (isOpen) {
        cardScene.classList.add("has-opened");
        closeButton.focus();
    } else {
        openButton.focus();
    }
}

function showInvitationPage() {
    cardScene.classList.remove("is-menu-open");
    invitationPage.inert = false;
    invitationPage.setAttribute("aria-hidden", "false");
    menuPage.inert = true;
    menuPage.setAttribute("aria-hidden", "true");
    invitationPage.focus({ preventScroll: true });
}

function showMenuPage() {
    cardScene.classList.add("is-menu-open", "has-opened-menu");
    invitationPage.inert = true;
    invitationPage.setAttribute("aria-hidden", "true");
    menuPage.inert = false;
    menuPage.setAttribute("aria-hidden", "false");
    menuTitle.focus({ preventScroll: true });
}

function handlePageTurn(event, turnPage) {
    if (event.target.closest("button, input, label, a")) {
        return;
    }

    if (turnPage) {
        showMenuPage();
    } else {
        showInvitationPage();
    }
}

function handlePageKeydown(event, page, turnPage) {
    if ((event.target !== page && event.target !== menuTitle) || (event.key !== "Enter" && event.key !== " ")) {
        return;
    }

    event.preventDefault();
    handlePageTurn(event, turnPage);
}

function markDishSubmitted(message) {
    hasSubmittedDish = true;
    dishOptions.forEach((option) => {
        option.disabled = true;
    });
    submitDishButton.disabled = true;
    submitDishButton.textContent = "Elección enviada";
    dishFeedback.textContent = message;
}

function getVoterId() {
    let voterId = localStorage.getItem(voterIdStorageKey);

    if (!voterId) {
        voterId = window.crypto && typeof window.crypto.randomUUID === "function"
            ? window.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(voterIdStorageKey, voterId);
    }

    return voterId;
}

openButton.addEventListener("click", () => setCardOpen(true));
closeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    setCardOpen(false);
});
invitationPage.addEventListener("click", (event) => handlePageTurn(event, true));
menuPage.addEventListener("click", (event) => handlePageTurn(event, false));
invitationPage.addEventListener("keydown", (event) => handlePageKeydown(event, invitationPage, true));
menuPage.addEventListener("keydown", (event) => handlePageKeydown(event, menuPage, false));

dishOptions.forEach((option) => {
    option.addEventListener("change", () => {
        const dishName = option.parentElement.querySelector("span").textContent;
        dishFeedback.textContent = `Has elegido: ${dishName}.`;
    });
});

if (hasSubmittedDish) {
    markDishSubmitted("Ya has enviado tu elección desde este navegador.");
}

window.addEventListener("storage", (event) => {
    if (event.key === submissionStorageKey && event.newValue === "submitted") {
        markDishSubmitted("Ya has enviado tu elección desde este navegador.");
    }
});

dishForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (hasSubmittedDish || isSubmittingDish) {
        return;
    }

    const selectedDish = Array.from(dishOptions).find((option) => option.checked);

    if (!selectedDish) {
        dishFeedback.textContent = "Selecciona un plato antes de enviar.";
        dishOptions[0].focus();
        return;
    }

    isSubmittingDish = true;
    submitDishButton.disabled = true;
    dishOptions.forEach((option) => {
        option.disabled = true;
    });
    dishFeedback.textContent = "Enviando tu elección...";

    try {
        await fetch(submissionEndpoint, {
            method: "POST",
            mode: "no-cors",
            body: new URLSearchParams({
                dish: selectedDish.value,
                voteId: getVoterId(),
            }),
        });
        localStorage.setItem(submissionStorageKey, "submitted");
        markDishSubmitted("¡Gracias! Tu elección se ha enviado.");
    } catch (error) {
        console.error("No se pudo enviar la elección del plato principal.", error);
        dishOptions.forEach((option) => {
            option.disabled = false;
        });
        submitDishButton.disabled = false;
        dishFeedback.textContent = "No se pudo enviar. Comprueba tu conexión e inténtalo de nuevo.";
    } finally {
        isSubmittingDish = false;
    }
});