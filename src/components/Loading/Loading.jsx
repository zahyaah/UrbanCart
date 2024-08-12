import { motion } from 'framer-motion';

function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen relative">
      <motion.div
        className="h-12 w-12 bg-[#8785A2] rounded-full"
        initial={{ y: 0 }}
        animate={{ y: [0, window.innerHeight / 2 - 24, 0] }}
        transition={{
          repeat: Infinity,
          duration: 1,
          ease: "easeInOut",
          repeatType: "loop",
          bounce: 0.5
        }}
      />
    </div>
  );
}

export default Loading;
