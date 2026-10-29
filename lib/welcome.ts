// Remembers that this device has closed the welcome pop-up, so it isn't shown again.
const STORAGE_KEY = "study-abroad-mapper:welcome-seen";

export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // No storage (server, private window, blocked site data): show it.
    return false;
  }
}

export function markWelcomeSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Not being able to remember is fine; it just shows again next time.
  }
}
