export const BenAttribution = () => {
  return (
    <div className=" flex gap-2 absolute top-0 right-0 bg-slate-500 text-slate-900 bg-opacity-20 rounded-full px-3 py-1 m-2 text-xs">
      <p>
        powered by{" "}
        <a
          className="hover:underline hover:text-slate-700"
          target="_blank"
          rel="noreferrer"
          href="https://orth.uk/"
        >
          Ben Butterworth
        </a>
      </p>
    </div>
  );
};
