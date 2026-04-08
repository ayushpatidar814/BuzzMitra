import React from "react";

const SIZE_MAP = {
  xs: "h-10 w-8",
  sm: "h-12 w-10",
  md: "h-14 w-12",
  lg: "h-16 w-12",
  xl: "h-24 w-20",
  profile: "h-32 w-24",
};

const Avatar = ({
  src,
  alt = "Profile",
  size = "md",
  className = "",
  imgClassName = "",
  onClick,
}) => {
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;
  const clickable = typeof onClick === "function";

  return (
    <div
      onClick={onClick}
      className={`overflow-hidden rounded-[0.7rem] bg-slate-200 shadow-sm ring-1 ring-black/5 ${sizeClasses} ${clickable ? "cursor-pointer" : ""} ${className}`}
    >
      <img
        src={src || "https://placehold.co/240x300"}
        alt={alt}
        className={`h-full w-full object-cover object-center ${imgClassName}`}
      />
    </div>
  );
};

export default Avatar;
