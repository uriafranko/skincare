type ChromaCharacterProps = {
  active?: boolean;
  className?: string;
  label?: string;
  resolution?: "compact" | "large";
};

const FACE_SRC = "/character/lily-persona-face.png";
const FIGURE_SRC = "/character/lily-persona-guide.png";

export function ChromaCharacter({
  className = "",
  label,
  resolution = "large",
}: ChromaCharacterProps) {
  const compact = resolution === "compact";
  const containerClass = `relative ${
    compact ? "aspect-square overflow-hidden rounded-full bg-[#f3eee4]" : "aspect-[2/3]"
  } ${className}`;
  const character = (
    <img
      src={compact ? FACE_SRC : FIGURE_SRC}
      alt=""
      className={
        compact
          ? "absolute left-1/2 top-1/2 h-[88%] w-[88%] -translate-x-1/2 -translate-y-1/2 object-contain"
          : "absolute inset-0 h-full w-full object-contain"
      }
      draggable={false}
    />
  );

  if (label) {
    return (
      <div className={containerClass} role="img" aria-label={label}>
        {character}
      </div>
    );
  }

  return (
    <div className={containerClass} aria-hidden="true">
      {character}
    </div>
  );
}
