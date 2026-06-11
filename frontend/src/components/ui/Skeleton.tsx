export const Skeleton = ({ className }: { className?: string }) => (
  <div
    className={`animate-pulse bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:400%_100%] rounded-xl ${className}`}
    style={{
      backgroundSize: "400% 100%",
      animation: "pulse 1.5s ease-in-out infinite",
    }}
  />
);
