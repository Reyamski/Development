import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import SummaryBar from './components/comparison/SummaryBar';
import FileList from './components/comparison/FileList';
import DiffView from './components/diff/DiffView';
import MigrationPreview from './components/diff/MigrationPreview';

export default function App() {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <SummaryBar />
          <div className="flex-1 flex overflow-hidden">
            <div className="w-72 border-r border-gray-800 flex flex-col overflow-hidden">
              <FileList />
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              <DiffView />
              <MigrationPreview />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
