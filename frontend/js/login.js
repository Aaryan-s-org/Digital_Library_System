"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("[data-login-form]");
  const submitButton = document.querySelector("[data-login-submit]");
  const errorBox = document.querySelector("[data-login-error]");
  
  if (!form) return;
  
  const userInput = document.querySelector("#username");
  const passInput = document.querySelector("#password");

  document.querySelectorAll("[data-demo-user]").forEach(btn => {
    btn.addEventListener("click", () => {
      const u = btn.dataset.demoUser;
      const p = btn.dataset.demoPass;
      if (userInput) userInput.value = u;
      if (passInput) passInput.value = p;
      // Highlight selected chip
      document.querySelectorAll("[data-demo-user]").forEach(b => {
        b.style.borderColor = "var(--color-hairline)";
        b.style.background = "white";
        b.style.color = "inherit";
      });
      btn.style.borderColor = "var(--color-primary, #1a365d)";
      btn.style.background = "var(--color-primary-soft, #ebf8ff)";
      btn.style.color = "var(--color-primary, #1a365d)";
      btn.style.fontWeight = "700";
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = "Signing in...";
    errorBox.hidden = true;
    
    const formData = new FormData(form);
    const username = formData.get("username");
    const password = formData.get("password");
    
    try {
      const result = await window.API.login(username, password);
      if (result && result.success) {
        window.location.href = window.Auth.getDashboardUrl();
      } else {
        errorBox.textContent = result?.message || "Invalid username or password.";
        errorBox.hidden = false;
        submitButton.disabled = false;
        submitButton.textContent = "Sign in";
      }
    } catch (err) {
      errorBox.textContent = "An error occurred during sign in.";
      errorBox.hidden = false;
      submitButton.disabled = false;
      submitButton.textContent = "Sign in";
    }
  });
});
