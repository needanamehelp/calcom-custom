import React, { useState } from "react";
import { showToast } from "@calcom/ui/components/toast";
import KeyField from "./KeyInput";

interface KeyInputWithValidationProps {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  disabled?: boolean;
}

const KeyInputWithValidation: React.FC<KeyInputWithValidationProps> = ({
  label,
  name,
  defaultValue,
  required = false,
  disabled = false,
}) => {
  const [value, setValue] = useState(defaultValue);
  const [valid, setValid] = useState<null | boolean>(null);
  const [loading, setLoading] = useState(false);

  const validateKey = async (val: string) => {
    setLoading(true);
    setValid(null);
    try {
      const key_id = name === "key_id" ? val : undefined;
      const key_secret = name === "key_secret" ? val : undefined;
      // Only validate if both fields are filled (handled at parent form level)
      if (!key_id && !key_secret) return;
      const res = await fetch("/api/razorpay/validateApp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: key_id || value, key_secret: key_secret || value }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setValid(true);
        showToast("Razorpay credentials are valid", "success");
      } else {
        setValid(false);
        showToast(data.message || "Invalid Razorpay credentials", "error");
      }
    } catch (e: any) {
      setValid(false);
      showToast(e.message || "Validation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <KeyField
        label={label}
        name={name}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        onBlur={e => validateKey(e.target.value)}
        onChange={e => setValue(e.target.value)}
      />
      {loading && <span className="text-xs text-gray-500">Validating...</span>}
      {valid === true && <span className="text-xs text-green-600">Valid key</span>}
      {valid === false && <span className="text-xs text-red-600">Invalid key</span>}
    </div>
  );
};

export default KeyInputWithValidation;
