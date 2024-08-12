import { motion } from 'framer-motion';

function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <motion.div
        className="inline-block w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full"
        animate={{
          rotate: 360,
        }}
        transition={{
          repeat: Infinity,
          duration: 0.8,
          ease: 'linear',
        }}
      />
    </div>
  );
};

export default Loading;
