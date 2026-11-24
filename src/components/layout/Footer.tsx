import { Link } from 'react-router-dom';
import { environmentFamilies } from '../../data/environments';

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#07090E]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-4 space-y-4">
            <Link
              to="/"
              className="font-display text-base font-bold tracking-[0.14em] text-white"
            >
              THINKNET
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              Researching Intelligence. Engineering the Future.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              Intelligence should be developed through knowledge, computation, interaction,
              experimentation and experience.
            </p>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
              Environment Families
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              {environmentFamilies.map((fam) => (
                <li key={fam.id}>
                  <Link
                    to={`/environments/${fam.slug}`}
                    className="hover:text-white transition-colors"
                  >
                    {fam.number}. {fam.shortName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
              Research & Systems
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/infrastructure" className="hover:text-white transition-colors">
                  Research Infrastructure
                </Link>
              </li>
              <li>
                <Link to="/data-generator" className="hover:text-white transition-colors">
                  Data Generator
                </Link>
              </li>
              <li>
                <Link to="/episodes" className="hover:text-white transition-colors">
                  Universal Episode Engine
                </Link>
              </li>
              <li>
                <Link to="/agentic-ai" className="hover:text-white transition-colors">
                  Agentic Research System
                </Link>
              </li>
              <li>
                <Link to="/liio" className="hover:text-white transition-colors">
                  LIIO Observatory
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-3">
            <h3 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
              Organization
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/research" className="hover:text-white transition-colors">
                  Research Hub
                </Link>
              </li>
              <li>
                <Link to="/research/register" className="hover:text-white transition-colors">
                  Research Register
                </Link>
              </li>
              <li>
                <Link to="/research/evaluation" className="hover:text-white transition-colors">
                  Evaluation Standards
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About ThinkNet
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/[0.06] pt-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>ThinkNet AI Research & Engineering Ecosystem</span>
          <span>Researching Intelligence · Engineering the Future</span>
        </div>
      </div>
    </footer>
  );
}
