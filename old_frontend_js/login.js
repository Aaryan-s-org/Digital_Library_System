"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("[data-login-form]");
  const submitButton = document.querySelector("[data-login-submit]");
  const errorBox = document.querySelector("[data-login-error]");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitButton.disabled = false;
    submitButton.textContent = "Sign in";
    errorBox.textContent = "Authentication will be connected by the team later.";
    errorBox.hidden = false;
  });
});
