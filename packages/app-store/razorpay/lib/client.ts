declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(callback: () => void) {
  // If the script is already loaded, call the callback
  if (window.Razorpay) {
    callback();
    return;
  }

  // Create a new script element
  const script = document.createElement("script");
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.async = true;
  
  // When the script is loaded, call the callback
  script.onload = () => {
    callback();
  };
  
  // Append the script to the document
  document.body.appendChild(script);
}

const getRazorpay = (callback: (razorpay: any) => void) => {
  loadRazorpayScript(() => {
    if (window.Razorpay) {
      callback(window.Razorpay);
    } else {
      console.error("Razorpay script failed to load");
    }
  });
};

export default getRazorpay; 