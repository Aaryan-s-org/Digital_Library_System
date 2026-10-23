/**
 * subscriptionModal.js — Razorpay Payment Gateway & Subscription Modal
 * Clean typography without emojis. Supports test key & sandbox checkout.
 */
"use strict";

(function () {
  let razorpayLoaded = false;

  function loadRazorpayScript() {
    if (razorpayLoaded || window.Razorpay) {
      razorpayLoaded = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => {
        razorpayLoaded = true;
        resolve();
      };
      script.onerror = () => {
        console.warn("Could not load external Razorpay checkout script. Fallback modal enabled.");
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  function createModalHtml(bookTitle) {
    const titleContext = bookTitle 
      ? `<div class="sub-modal__context"><span>Exclusive Title:</span> <strong>${escapeHtml(bookTitle)}</strong></div>`
      : "";

    return `
      <div class="sub-modal-overlay" id="subscription-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="sub-modal-title">
        <div class="sub-modal-backdrop" data-sub-close></div>
        <div class="sub-modal-card">
          <button type="button" class="sub-modal__close" data-sub-close aria-label="Close subscription modal">&times;</button>
          
          <div class="sub-modal__header">
            <span class="sub-modal__badge">Digital Library Membership</span>
            <h2 class="sub-modal__title" id="sub-modal-title">Unlock Exclusive Reading</h2>
            <p class="sub-modal__subtitle">Gain unlimited, unrestricted access to all curated exclusive literature, archival scans, and priority in-browser reading.</p>
            ${titleContext}
          </div>

          <div class="sub-modal__plans" role="radiogroup" aria-label="Select a subscription plan">
            <label class="sub-plan-card is-selected" data-plan="premium_monthly">
              <input type="radio" name="sub_plan" value="premium_monthly" checked />
              <div class="sub-plan-card__header">
                <span class="sub-plan-name">Monthly Premium</span>
                <span class="sub-plan-badge">Popular</span>
              </div>
              <div class="sub-plan-price">
                <span class="sub-plan-currency">&#8377;</span>
                <span class="sub-plan-amount">299</span>
                <span class="sub-plan-period">/ month</span>
              </div>
              <p class="sub-plan-desc">Access all exclusive e-books, sync bookmarks across devices, and enjoy uninterrupted digital reading.</p>
            </label>

            <label class="sub-plan-card" data-plan="premium_annual">
              <input type="radio" name="sub_plan" value="premium_annual" />
              <div class="sub-plan-card__header">
                <span class="sub-plan-name">Annual VIP Access</span>
                <span class="sub-plan-badge sub-plan-badge--vip">Save 30%</span>
              </div>
              <div class="sub-plan-price">
                <span class="sub-plan-currency">&#8377;</span>
                <span class="sub-plan-amount">2,499</span>
                <span class="sub-plan-period">/ year</span>
              </div>
              <p class="sub-plan-desc">Full 365-day access to all present and upcoming exclusive collections with priority AI book recommendations.</p>
            </label>
          </div>

          <div class="sub-modal__benefits">
            <div class="sub-benefit-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Instant unlock for all exclusive catalogue titles</span>
            </div>
            <div class="sub-benefit-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Direct offline reading and export capabilities</span>
            </div>
            <div class="sub-benefit-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Official receipt and transaction record for your account</span>
            </div>
          </div>

          <div class="sub-modal__actions">
            <button type="button" class="button button--primary sub-modal__submit" data-sub-pay>
              <span>Proceed to Razorpay Secure Payment</span>
            </button>
            <div class="sub-modal__secure-note">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <span data-sub-gateway-note>Razorpay Test API Gateway &bull; 256-bit SSL Encryption</span>
            </div>
            <p class="sub-modal__feedback" data-sub-feedback role="status"></p>
          </div>
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
  }

  const SubscriptionModal = {
    async open(options = {}) {
      const { bookTitle = "", onComplete = null } = options;

      // Ensure user is signed in
      if (!window.API || !window.API.isAuthenticated()) {
        const confirmLogin = window.confirm("Please sign in or create an account to activate a subscription. Redirect to sign in?");
        if (confirmLogin) {
          window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.href)}`;
        }
        return;
      }

      // Remove existing modal if any
      const existing = document.getElementById("subscription-modal-overlay");
      if (existing) existing.remove();

      // Load Razorpay script
      loadRazorpayScript();

      // Inject modal
      document.body.insertAdjacentHTML("beforeend", createModalHtml(bookTitle));
      const overlay = document.getElementById("subscription-modal-overlay");

      // Bind close buttons
      overlay.querySelectorAll("[data-sub-close]").forEach((btn) => {
        btn.addEventListener("click", () => overlay.remove());
      });

      // Display gateway connectivity status
      const gatewayNote = overlay.querySelector("[data-sub-gateway-note]");
      if (window.API && window.API.getPaymentConfig) {
        window.API.getPaymentConfig().then((cfg) => {
          if (gatewayNote && cfg) {
            if (cfg.isTestKey) {
              gatewayNote.textContent = `Razorpay Test API Connected (${cfg.keyId.substring(0, 12)}…) • Test Mode`;
            } else {
              gatewayNote.textContent = `Razorpay Sandbox Test Mode (Ready for test key in .env)`;
            }
          }
        }).catch(() => {});
      }

      // Plan selection toggle
      const planCards = overlay.querySelectorAll(".sub-plan-card");
      planCards.forEach((card) => {
        card.addEventListener("click", () => {
          planCards.forEach((c) => c.classList.remove("is-selected"));
          card.classList.add("is-selected");
          const radio = card.querySelector("input[type='radio']");
          if (radio) radio.checked = true;
        });
      });

      // Bind Pay Button
      const payBtn = overlay.querySelector("[data-sub-pay]");
      const feedback = overlay.querySelector("[data-sub-feedback]");

      payBtn.addEventListener("click", async () => {
        const selectedRadio = overlay.querySelector("input[name='sub_plan']:checked");
        const planId = selectedRadio ? selectedRadio.value : "premium_monthly";
        const user = window.API.getUser() || {};

        payBtn.disabled = true;
        feedback.className = "sub-modal__feedback is-loading";
        feedback.textContent = "Initiating secure order with Razorpay…";

        try {
          const orderRes = await window.API.createPaymentOrder(planId);
          if (!orderRes || !orderRes.success) {
            throw new Error(orderRes?.message || "Failed to initiate payment order");
          }

          const { orderId, amount, currency, keyId, planName, isRealOrder } = orderRes;
          const hasRealKey = Boolean(
            keyId &&
            keyId.startsWith("rzp_test_") &&
            !keyId.includes("your_") &&
            !keyId.includes("demo")
          );

          // If Razorpay SDK is loaded and a real Razorpay test key is configured in .env
          if (window.Razorpay && hasRealKey) {
            const rzpOptions = {
              key: keyId,
              amount: amount,
              currency: currency || "INR",
              name: "Digital Library",
              description: `Subscription: ${planName}`,
              order_id: isRealOrder ? orderId : undefined,
              prefill: {
                name: user.username || "Reader",
                email: user.email || ""
              },
              theme: {
                color: "#1b2a26"
              },
              handler: async function (response) {
                feedback.className = "sub-modal__feedback is-loading";
                feedback.textContent = "Verifying transaction signature…";
                try {
                  const verifyRes = await window.API.verifyPayment({
                    razorpay_order_id: response.razorpay_order_id || orderId,
                    razorpay_payment_id: response.razorpay_payment_id || `pay_${Date.now()}`,
                    razorpay_signature: response.razorpay_signature || "test_signature",
                    planId,
                    paymentMethod: "razorpay"
                  });

                  if (verifyRes && verifyRes.success) {
                    feedback.className = "sub-modal__feedback is-success";
                    feedback.textContent = "Subscription activated! Unlocking content…";

                    // Update local user state
                    const currentUser = window.API.getUser();
                    if (currentUser) {
                      currentUser.subscriptionTier = "Premium";
                      window.API.setUser(currentUser);
                    }

                    setTimeout(() => {
                      overlay.remove();
                      if (typeof onComplete === "function") {
                        onComplete(verifyRes);
                      } else {
                        window.location.reload();
                      }
                    }, 1200);
                  } else {
                    throw new Error(verifyRes?.message || "Payment verification failed");
                  }
                } catch (err) {
                  feedback.className = "sub-modal__feedback is-error";
                  feedback.textContent = `Verification error: ${err.message}`;
                  payBtn.disabled = false;
                }
              },
              modal: {
                ondismiss: function () {
                  feedback.className = "sub-modal__feedback";
                  feedback.textContent = "Payment cancelled. You can retry at any time.";
                  payBtn.disabled = false;
                }
              }
            };

            const rzp = new window.Razorpay(rzpOptions);
            rzp.on("payment.failed", function (resp) {
              feedback.className = "sub-modal__feedback is-error";
              feedback.textContent = `Payment failed: ${resp.error?.description || "Unknown error"}`;
              payBtn.disabled = false;
            });
            rzp.open();
          } else {
            // Direct Sandbox verification if test key is placeholder or SDK unavailable
            feedback.className = "sub-modal__feedback is-loading";
            feedback.textContent = "Processing test checkout gateway (Sandbox)…";
            const mockPaymentId = `pay_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const verifyRes = await window.API.verifyPayment({
              razorpay_order_id: orderId,
              razorpay_payment_id: mockPaymentId,
              razorpay_signature: "test_sandbox_signature",
              planId,
              paymentMethod: "razorpay_test"
            });

            if (verifyRes && verifyRes.success) {
              feedback.className = "sub-modal__feedback is-success";
              feedback.textContent = "Test payment successful! Premium access granted.";
              const currentUser = window.API.getUser();
              if (currentUser) {
                currentUser.subscriptionTier = "Premium";
                window.API.setUser(currentUser);
              }
              setTimeout(() => {
                overlay.remove();
                if (typeof onComplete === "function") onComplete(verifyRes);
                else window.location.reload();
              }, 1200);
            } else {
              throw new Error(verifyRes?.message || "Verification failed");
            }
          }
        } catch (err) {
          feedback.className = "sub-modal__feedback is-error";
          feedback.textContent = err.message;
          payBtn.disabled = false;
        }
      });
    }
  };

  window.SubscriptionModal = SubscriptionModal;
})();
