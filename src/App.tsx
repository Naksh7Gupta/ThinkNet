import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { CommandSearchModal } from './components/search/CommandSearchModal';
import { HomePage } from './pages/Home/HomePage';
import { ResearchHubPage } from './pages/Research/ResearchHubPage';
import { EnvironmentsOverviewPage } from './pages/Environments/EnvironmentsOverviewPage';
import { FamilyDetailPage } from './pages/Environments/FamilyDetailPage';
import { EpisodesDirectoryPage } from './pages/Episodes/EpisodesDirectoryPage';
import { EpisodeDetailPage } from './pages/Episodes/EpisodeDetailPage';
import { InfrastructureOverviewPage } from './pages/Infrastructure/InfrastructureOverviewPage';
import { DivisionDetailPage } from './pages/Infrastructure/DivisionDetailPage';
import { AgenticAIPage } from './pages/AgenticAI/AgenticAIPage';
import { LIIOPage } from './pages/LIIO/LIIOPage';
import { AboutPage } from './pages/About/AboutPage';
import { DataGeneratorPage } from './pages/DataGenerator/DataGeneratorPage';

function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);

  return null;
}

function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#07090E] text-[#E6EAF2]">
      <ScrollManager />
      <Navbar onOpenSearch={() => setSearchOpen(true)} />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* Research */}
          <Route path="/research" element={<ResearchHubPage section="overview" />} />
          <Route path="/research/register" element={<ResearchHubPage section="register" />} />
          <Route path="/research/training" element={<ResearchHubPage section="training" />} />
          <Route path="/research/evaluation" element={<ResearchHubPage section="evaluation" />} />
          <Route path="/research/roadmap" element={<ResearchHubPage section="roadmap" />} />

          {/* Environments */}
          <Route path="/environments" element={<EnvironmentsOverviewPage />} />
          <Route path="/environments/:familySlug" element={<FamilyDetailPage />} />

          {/* Episodes & Universal Episode Engine */}
          <Route path="/episodes" element={<EpisodesDirectoryPage />} />
          <Route path="/episodes/:episodeSlug" element={<EpisodeDetailPage />} />

          {/* Infrastructure */}
          <Route path="/infrastructure" element={<InfrastructureOverviewPage />} />
          <Route path="/infrastructure/:divisionSlug" element={<DivisionDetailPage />} />

          {/* Synthetic Data Generator */}
          <Route path="/data-generator" element={<DataGeneratorPage />} />

          {/* Agentic AI */}
          <Route path="/agentic-ai" element={<AgenticAIPage />} />

          {/* LIIO */}
          <Route path="/liio" element={<LIIOPage />} />

          {/* About */}
          <Route path="/about" element={<AboutPage />} />

          {/* Fallback */}
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
      <Footer />
      <CommandSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
