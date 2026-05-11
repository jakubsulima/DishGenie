import { Link } from "react-router-dom";

interface RecipeContainerProps {
  id: number;
  title: string;
  timeToPrepare: string;
}

const RecipeContainer = ({
  title,
  id,
  timeToPrepare,
}: RecipeContainerProps) => {
  return (
    <Link
      to={`/recipe/${id}`}
      className="group flex flex-col rounded-2xl border border-primary/10 bg-secondary p-5 transition-all duration-300 hover:border-accent/30 hover:bg-secondary/80 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent/50 sm:flex-row sm:items-center sm:justify-between"
    >
        <div className="flex-1 mb-3 sm:mb-0">
          <h2 className="text-xl font-semibold text-text group-hover:text-accent transition-colors leading-tight">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-text/70 text-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-medium">{timeToPrepare}</span>
        </div>
    </Link>
  );
};

export default RecipeContainer;
