import React from 'react';
import InvestmentCalculator from './components/InvestmentCalculator';

const App: React.FC = () => {
  return (
    <div className="container w-full mx-auto p-4">
      <h1 className="text-3xl font-bold text-primary mb-6">Investment Fee Calculator</h1>
      <InvestmentCalculator />
    </div>
  );
};

export default App; 