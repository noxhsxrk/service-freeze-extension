document.addEventListener("DOMContentLoaded", async () => {
  const orgInput = document.getElementById("org");
  const apiKeyInput = document.getElementById("apiKey");
  const status = document.getElementById("status");

  const result = await chrome.storage.sync.get(["organization", "apiKey"]);
  if (result.organization) orgInput.value = result.organization;
  if (result.apiKey) apiKeyInput.value = result.apiKey;

  document.getElementById("save").addEventListener("click", async () => {
    const organization = orgInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    
    if (!organization) {
      status.textContent = "Please enter a valid organization name.";
      status.style.color = "red";
      return;
    }

    if (!apiKey) {
      status.textContent = "Please enter a valid API key.";
      status.style.color = "red";
      return;
    }

    await chrome.storage.sync.set({ organization, apiKey });
    status.textContent = `Settings saved successfully!`;
    status.style.color = "green";
  });
});
