import Link from "next/link";
import { Button } from "./ui/button";

type Props = {
  text: string;
  backgroundColor?: string;
  textColor?: string;
  onClick?: () => void;
  hoverBackgroundColor?: string;
  hoverTextColor?: string;
  fullWidth?: boolean;
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  className?: string;
  link?: string;
  target?: string;
  rel?: string;
  type?: "submit" | "reset" | "button";
  border?: string;
};

function ReusableButton({
  text,
  backgroundColor = "bg-white",
  textColor = "text-slate-800",
  onClick,
  hoverBackgroundColor = "hover:bg-slate-100",
  hoverTextColor = "hover:text-slate-800",
  fullWidth = false,
  size = "medium",
  disabled = false,
  className = "",
  link,
  target,
  rel,
  type = "button",
  border = "",
}: Props) {
  // Calculate text length for responsive adjustments
  const textLength = text.length;
  const isLongText = textLength > 20;
  const isVeryLongText = textLength > 40;

  // Dynamic size classes that adapt to text length
  const getSizeClasses = () => {
    const baseClasses = {
      small: {
        padding: isVeryLongText
          ? "px-3 sm:px-4 py-2 sm:py-2.5"
          : isLongText
          ? "px-3 sm:px-5 py-2 sm:py-3"
          : "px-4 sm:px-6 py-2 sm:py-3",
        text: isVeryLongText ? "text-xs" : "text-xs",
        tracking: isLongText ? "tracking-normal" : "tracking-wide",
      },
      medium: {
        padding: isVeryLongText
          ? "px-4 sm:px-6 py-3 sm:py-4"
          : isLongText
          ? "px-6 sm:px-8 py-4 sm:py-5"
          : "px-8 sm:px-12 py-4 sm:py-6",
        text: isVeryLongText ? "text-xs sm:text-sm" : "text-xs sm:text-sm",
        tracking: isLongText
          ? "tracking-normal sm:tracking-wide"
          : "tracking-widest",
      },
      large: {
        padding: isVeryLongText
          ? "px-6 sm:px-8 py-4 sm:py-5"
          : isLongText
          ? "px-8 sm:px-10 py-5 sm:py-6"
          : "px-12 sm:px-16 py-6 sm:py-8",
        text: isVeryLongText ? "text-sm" : "text-sm sm:text-base",
        tracking: isLongText
          ? "tracking-normal sm:tracking-wide"
          : "tracking-widest",
      },
    };

    return `${baseClasses[size].padding} ${baseClasses[size].text} ${baseClasses[size].tracking}`;
  };

  // Width classes with better responsive behavior
  const getWidthClasses = () => {
    if (fullWidth) return "w-full";

    // For very long text, always full width on mobile
    if (isVeryLongText) return "w-full sm:w-auto sm:min-w-fit";

    // For long text, be more generous with width
    if (isLongText) return "w-full sm:w-auto sm:min-w-[200px]";

    return "w-full sm:w-auto";
  };

  // Additional responsive classes for text handling
  const getTextClasses = () => {
    if (isVeryLongText) {
      return "break-words text-center leading-tight sm:leading-normal";
    }
    if (isLongText) {
      return "break-words text-center leading-normal";
    }
    return "text-center whitespace-nowrap sm:whitespace-normal";
  };

  // Combine all classes
  const buttonClasses = `
    ${backgroundColor}
    ${hoverBackgroundColor}
    ${textColor}
    ${hoverTextColor}
    ${border}
    ${getSizeClasses()}
    ${getWidthClasses()}
    ${getTextClasses()}
    rounded-none
    transition-all
    duration-200
    disabled:opacity-50
    disabled:cursor-not-allowed
    font-medium
    ${className}
  `
    .replace(/\s+/g, " ")
    .trim();

  // If it's a link, render as anchor
  if (link) {
    return (
      <Link
        href={link}
        target={target}
        rel={rel}
        className={`inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:pointer-events-none ${buttonClasses}`}
        onClick={onClick}
      >
        <span className={isVeryLongText ? "px-1" : ""}>{text}</span>
      </Link>
    );
  }

  // Regular button
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={buttonClasses}
    >
      <span className={isVeryLongText ? "px-1" : ""}>{text}</span>
    </Button>
  );
}

export default ReusableButton;
