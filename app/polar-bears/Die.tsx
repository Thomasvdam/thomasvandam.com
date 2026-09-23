import type React from "react";
import styles from "@/app/experiment.module.css";

interface DieProps {
  color: string;
  rotation: number;
  value: 1 | 2 | 3 | 4 | 5 | 6;
}

interface PipProps {
  className: string;
}

const Pip: React.FC<PipProps> = ({ className }) => (
  <div className={`${styles.pip} ${className}`} />
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
    <div className={styles.die} style={{ backgroundColor: color, transform: `rotate(${rotation}deg)` }}>
      {pipPositions.map((position, index) => (
        <Pip
          key={index}
          className={styles[position.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()) as keyof typeof styles]}
        />
      ))}
    </div>
  );
};

export default Die;
