const Footer = () => {
  return (
    <footer className="py-8 px-8 border-t border-[#21262d] bg-[#0a0e1a]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-center gap-4 text-center">
        <p className="text-gray-500 text-sm">
          © 2026 DevCollab. Built for developers, by developers.
        </p>
        
        <div className="flex items-center gap-2 text-gray-500 text-sm md:ml-auto">
          <span>⚡</span>
          <span>Made with Emergent</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
