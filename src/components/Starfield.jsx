import { useEffect, useState } from "react";

export default function Starfield({ count = 120 }) {
  const [stars, setStars] = useState([]);

  useEffect(() => {
    const generateStars = () => {
      const newStars = [];
      for (let i = 0; i < count; i++) {
        newStars.push({
          id: i,
          left: Math.random() * 100,
          top: Math.random() * 100,
          size: Math.random() * 3 + 1,
          duration: Math.random() * 4 + 2,
          delay: Math.random() * 5,
        });
      }
      setStars(newStars);
    };

    generateStars();
  }, [count]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {stars.map((star) => (
        <span
          key={star.id}
          className="absolute rounded-full bg-white opacity-40"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animation: `twinkle ${star.duration}s linear infinite`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
