interface PedestrianNetworkIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export default function PedestrianNetworkIcon({
  size = 24,
  color = "#e3e3e3",
  className
}: PedestrianNetworkIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height={size}
      viewBox="0 -960 960 960"
      width={size}
      fill={color}
      className={className}
    >
      <path d="M520-40v-160h-40L360-520l-64 28v132h-80v-172l124-54-40-76q-12-23-34-40.5T216-720l-16 72-78-18 28-124q5-21 19-36.5t34-24.5q20-9 41.5-9t40.5 9l56 24q46 20 73.5 60t27.5 89v98l40 72 72-28q23-9 42.5-3t31.5 23l124 124-56 56-96-96-122 50L440-40h-80Zm20-700q-33 0-56.5-23.5T460-820q0-33 23.5-56.5T540-900q33 0 56.5 23.5T620-820q0 33-23.5 56.5T540-740Z"/>
    </svg>
  );
}
