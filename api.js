const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadButton = document.querySelector("#load-btn");
const noteForm = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitButton = document.querySelector("#submit-btn");
const statusMessage = document.querySelector("#status");
const notesList = document.querySelector("#notes-list");

let notes = [];
let nextClientKey = 0;

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    // fetch only rejects when the request never reached a server.
    throw new Error("Check your internet connection and try again.");
  }
  if (!response.ok) {
    throw new Error(`The server returned status ${response.status}.`);
  }
  return response;
}

function setStatus(message, kind = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status${kind ? ` status-${kind}` : ""}`;
}

function setButtonsDisabled(disabled) {
  loadButton.disabled = disabled;
  submitButton.disabled = disabled;
  notesList.querySelectorAll(".delete-button").forEach((button) => {
    button.disabled = disabled;
  });
}

function renderNotes() {
  notesList.replaceChildren();
  if (notes.length === 0) {
    const emptyMessage = document.createElement("li");
    emptyMessage.className = "empty-message";
    emptyMessage.textContent = "No notes yet. Create a note or load notes from the server.";
    notesList.append(emptyMessage);
    return;
  }

  for (const note of notes) {
    const item = document.createElement("li");
    item.className = "note-card";

    const title = document.createElement("h3");
    title.textContent = note.title;

    const body = document.createElement("p");
    body.className = "note-body";
    body.textContent = note.body || "No body provided.";

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.dataset.clientKey = String(note.clientKey);
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete note: ${note.title}`);

    item.append(title, body, deleteButton);
    notesList.append(item);
  }
}

async function getNotes() {
  const response = await request(`${API_URL}?_limit=10`);
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("The server returned an unexpected notes response.");
  }
  return data.map((note) => ({ ...note, clientKey: nextClientKey++ }));
}

async function createNote(note) {
  const response = await request(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(note),
  });
  return { note: await response.json(), status: response.status };
}

async function deleteNote(id) {
  return request(`${API_URL}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

loadButton.addEventListener("click", async () => {
  setButtonsDisabled(true);
  setStatus("Loading notes...", "loading");
  try {
    // Keep notes created in this session: JSONPlaceholder doesn't store them,
    // so reloading would otherwise make them disappear.
    const createdHere = notes.filter((note) => note.createdHere);
    notes = [...createdHere, ...(await getNotes())];
    renderNotes();
    if (notes.length === 0) {
      setStatus("No notes found. Create a note to get started.", "success");
    } else {
      setStatus(`Loaded ${notes.length - createdHere.length} notes from the server.`, "success");
    }
  } catch (error) {
    setStatus(`Could not load notes. ${error.message}`, "error");
  } finally {
    setButtonsDisabled(false);
  }
});

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title) {
    setStatus("Please enter a title.", "error");
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    setStatus("Titles must be 100 characters or fewer.", "error");
    titleInput.focus();
    return;
  }

  setButtonsDisabled(true);
  setStatus("Creating note...", "loading");
  try {
    const result = await createNote({ title, body, userId: 1 });
    // JSONPlaceholder returns a simulated ID and does not persist POSTs; keep this note in the current client list only.
    const createdNote = {
      ...result.note,
      title,
      body,
      clientKey: nextClientKey++,
      createdHere: true,
    };
    notes.unshift(createdNote);
    renderNotes();
    setStatus(
      `Note created (status ${result.status}, id ${createdNote.id}).`,
      "success",
    );
    noteForm.reset();
  } catch (error) {
    setStatus(`Could not create the note. ${error.message}`, "error");
  } finally {
    setButtonsDisabled(false);
  }
});

notesList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const deleteButton = target.closest(".delete-button");
  if (!(deleteButton instanceof HTMLButtonElement)) {
    return;
  }

  const note = notes.find(
    (item) => String(item.clientKey) === deleteButton.dataset.clientKey,
  );
  if (!note) {
    return;
  }

  setButtonsDisabled(true);
  setStatus("Deleting note...", "loading");
  try {
    await deleteNote(note.id);
    notes = notes.filter((item) => item.clientKey !== note.clientKey);
    renderNotes();
    setStatus("Note deleted.", "success");
  } catch (error) {
    setStatus(`Could not delete the note. ${error.message}`, "error");
  } finally {
    setButtonsDisabled(false);
  }
});

renderNotes();
