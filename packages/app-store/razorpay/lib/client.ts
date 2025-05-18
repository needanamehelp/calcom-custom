declare global {
  interface Window {
    Razorpay: any;
  }
  interface HTMLScriptElement {
    onreadystatechange?: () => void;
    readyState?: string;
  }
}

function loadRazorpayScript(callback: () => void) {
  // If the script is already loaded, call the callback
  if (window.Razorpay) {
    callback();
    return;
  }

  // Check if script is already loading
  const existingScript = document.getElementById('razorpay-checkout-script');
  if (existingScript) {
    // Wait for existing script to load
    if (existingScript.onload) {
      const originalOnload = existingScript.onload as () => void;
      existingScript.onload = () => {
        originalOnload();
        callback();
      };
    } else {
      existingScript.onload = () => callback();
    }
    return;
  }

  // Create a new script element
  const script = document.createElement("script");
  script.id = 'razorpay-checkout-script';
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.async = true;
  
  // For modern browsers
  script.onload = () => {
    callback();
  };

  // For older browsers
  script.onreadystatechange = () => {
    if (script.readyState === 'loaded' || script.readyState === 'complete') {
      script.onreadystatechange = function() {}; // Clear the handler
      callback();
    }
  };
  
  // Handle errors
  script.onerror = () => {
    console.error('Error loading Razorpay script');
    // Remove script tag on error
    if (script.parentNode) {
      script.parentNode.removeChild(script);
    }
  };
  
  // Append the script to the document
  document.body.appendChild(script);
}

const getRazorpay = (callback: (razorpay: any) => void, onError?: (error: Error) => void) => {
  try {
    loadRazorpayScript(() => {
      if (window.Razorpay) {
        try {
          callback(window.Razorpay);
        } catch (error) {
          console.error("Error initializing Razorpay:", error);
          if (onError && error instanceof Error) {
            onError(error);
          }
        }
      } else {
        const error = new Error("Razorpay script loaded but Razorpay is not available");
        console.error(error);
        if (onError) {
          onError(error);
        }
      }
    });
  } catch (error) {
    console.error("Error loading Razorpay script:", error);
    if (onError && error instanceof Error) {
      onError(error);
    }
  }
};

export default getRazorpay; 