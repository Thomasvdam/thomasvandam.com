import type React from "react";

interface DieProps {
  color: string;
  rotation: number;
  value: 1 | 2 | 3 | 4 | 5 | 6;
}

interface PipProps {
  className: string;
}

const Pip: React.FC<PipProps> = ({ className }) => (
  <div
    className={`absolute w-4 h-4 rounded-full bg-gray-900 ${className}`}
    style={{
      boxShadow: "0 0 2px 1px rgba(255, 255, 255, 0.3)",
    }}
  />
);

const Die: React.FC<DieProps> = ({ color, rotation, value }) => {
  const getPipPositions = () => {
    switch (value) {
      case 1:
        return ["center"];
      case 2:
        return ["top-left", "bottom-right"];
      case 3:
        return ["top-left", "center", "bottom-right"];
      case 4:
        return ["top-left", "top-right", "bottom-left", "bottom-right"];
      case 5:
        return [
          "top-left",
          "top-right",
          "center",
          "bottom-left",
          "bottom-right",
        ];
      case 6:
        return [
          "top-left",
          "top-right",
          "middle-left",
          "middle-right",
          "bottom-left",
          "bottom-right",
        ];
      default:
        return [];
    }
  };

  const pipPositions = getPipPositions();

  return (
    <div
    className={`relative w-24 h-24 rounded-lg flex items-center justify-center ${color}`}
      style={{
        transform: `rotate(${rotation}deg)`,
        boxShadow: `0 0 10px 2px rgba(255, 255, 255, 0.1), 
                     0 0 20px 4px rgba(255, 255, 255, 0.05),
                     0 4px 8px rgba(0, 0, 0, 0.5)`,
      }}
    >
      {pipPositions.map((position, index) => (
        <Pip
          key={index}
          className={`
            ${
              position === "center" &&
              "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            }
            ${position === "top-left" && "top-3 left-3"}
            ${position === "top-right" && "top-3 right-3"}
            ${
              position === "middle-left" &&
              "top-1/2 left-3 transform -translate-y-1/2"
            }
            ${
              position === "middle-right" &&
              "top-1/2 right-3 transform -translate-y-1/2"
            }
            ${position === "bottom-left" && "bottom-3 left-3"}
            ${position === "bottom-right" && "bottom-3 right-3"}
          `}
        />
      ))}
    </div>
  );
};

export default Die;
