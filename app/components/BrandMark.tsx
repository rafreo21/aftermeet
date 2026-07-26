import Image from "next/image";

type BrandMarkProps = {
  className?: string;
  size?: number;
};

export function BrandMark({ className, size = 36 }: BrandMarkProps) {
  return (
    <Image
      className={className}
      src="/aftermeet-logo.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}
