"use client";

import { useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { Activity, Apple, Droplet, Heart, Thermometer } from "lucide-react";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { usePrivateHealth } from "~~/hooks/usePrivateHealth";

// Health options
const HEARTS = ["Normal heart", "Slightly high heart", "High heart", "Very high heart"];
const BP = ["Normal BP", "Elevated BP", "High BP", "Very high BP"];
const SUGAR = ["Normal sugar", "Slightly high sugar", "High sugar", "Very high sugar"];
const CHOLESTEROL = ["Normal cholesterol", "Slightly high cholesterol", "High cholesterol", "Very high cholesterol"];
const TEMP = ["Normal temperature", "Low grade fever", "Fever", "High fever"];

// Generate all 1024 outcomes
const HEALTH_OUTCOMES: string[] = [];
for (let h = 0; h < 4; h++) {
  for (let b = 0; b < 4; b++) {
    for (let s = 0; s < 4; s++) {
      for (let c = 0; c < 4; c++) {
        for (let t = 0; t < 4; t++) {
          HEALTH_OUTCOMES.push(`${HEARTS[h]}, ${BP[b]}, ${SUGAR[s]}, ${CHOLESTEROL[c]}, ${TEMP[t]}`);
        }
      }
    }
  }
}

// Map answers to 1..1024 index
const mapAnswersToIndex = (answers: Record<string, number>) => {
  const { q1, q2, q3, q4, q5 } = answers;
  return (q1 - 1) * 256 + (q2 - 1) * 64 + (q3 - 1) * 16 + (q4 - 1) * 4 + (q5 - 1) + 1;
};

// Map index back to text
const mapIndexToOutcome = (index: number) => {
  if (index < 1 || index > 1024) return "Invalid index";
  return HEALTH_OUTCOMES[index - 1];
};

const HEALTH_QUESTIONS = [
  {
    key: "q1",
    title: "Heart Rate (bpm)",
    icon: <Heart />,
    options: [1, 2, 3, 4],
    map: { 1: "<60", 2: "60–80", 3: "81–100", 4: ">100" },
    color: "from-pink-500 to-red-500",
  },
  {
    key: "q2",
    title: "Blood Pressure (mmHg)",
    icon: <Activity />,
    options: [1, 2, 3, 4],
    map: { 1: "90–120", 2: "121–130", 3: "131–140", 4: ">140" },
    color: "from-indigo-500 to-purple-500",
  },
  {
    key: "q3",
    title: "Blood Sugar (mg/dL)",
    icon: <Droplet />,
    options: [1, 2, 3, 4],
    map: { 1: "<90", 2: "90–120", 3: "121–140", 4: ">140" },
    color: "from-green-400 to-green-600",
  },
  {
    key: "q4",
    title: "Cholesterol (mg/dL)",
    icon: <Apple />,
    options: [1, 2, 3, 4],
    map: { 1: "<180", 2: "180–200", 3: "201–240", 4: ">240" },
    color: "from-yellow-400 to-orange-500",
  },
  {
    key: "q5",
    title: "Body Temperature (°C)",
    icon: <Thermometer />,
    options: [1, 2, 3, 4],
    map: { 1: "36–36.5", 2: "36.6–37.0", 3: "37.1–38.0", 4: ">38" },
    color: "from-red-400 to-pink-500",
  },
];

export const FHEPrivateHealth = () => {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;
  const provider = useMemo(() => (typeof window !== "undefined" ? (window as any).ethereum : undefined), []);

  const initialMockChains = {
    11155111: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  };

  const { instance: fhevmInstance } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const survey = usePrivateHealth({ instance: fhevmInstance, supportedChains: initialMockChains });

  const [answers, setAnswers] = useState({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 });
  const [submitted, setSubmitted] = useState(false);
  const [decrypted, setDecrypted] = useState(false);
  const [outcome, setOutcome] = useState(0);

  const allAnswered = Object.values(answers).every(v => v > 0);

  const handleSelect = (key: keyof typeof answers, val: number) => {
    if (!survey.hasAlreadySubmitted && !decrypted) {
      setAnswers(a => ({ ...a, [key]: val }));
    }
  };

  const handleSubmit = async () => {
    const outcomeIndex = mapAnswersToIndex(answers);
    await survey.submitSurvey(outcomeIndex); // submit number 1..1024
    setSubmitted(true);
    setOutcome(outcomeIndex);
  };

  const handleDecrypt = async () => {
    await survey.decrypt();
    setDecrypted(true);
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-72px)] w-full text-center text-gray-100">
        <h2 className="text-4xl font-extrabold mb-6 text-pink-400">Connect your wallet to take the health 🩺</h2>
        <RainbowKitCustomConnectButton />
      </div>
    );
  }

  if (survey.hasAlreadySubmitted && !survey.decodedAnswer && !submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-72px)] w-full text-center text-gray-100">
        <h2 className="text-4xl font-extrabold mb-2 text-pink-400">You have already submitted the health!</h2>
        <p className="mb-6 text-cyan-300">Decrypt to see your health results 🩺</p>
        <button
          onClick={handleDecrypt}
          disabled={!survey.canDecrypt || survey.isDecrypting}
          className="px-10 py-4 rounded-3xl font-bold text-lg shadow-lg text-white bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 hover:scale-105 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {survey.isDecrypting ? "⏳ Decrypting..." : "🔓 Decrypt Health"}
        </button>
        {survey.statusMessage && <p className="mt-4 text-gray-300 italic">{survey.statusMessage}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] w-full p-6 flex flex-col items-center text-gray-100">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-extrabold mb-2 text-pink-700">Private Health 🩺</h1>
        <p className="text-lg text-cyan-300">All answers are fully encrypted with FHE 🔐</p>
      </div>

      <div className="flex flex-col gap-6 w-full max-w-3xl">
        {HEALTH_QUESTIONS.map(q => (
          <div
            key={q.key}
            className={`p-6 rounded-3xl shadow-lg border border-white/20 bg-gradient-to-r ${q.color} bg-opacity-10 backdrop-blur-md hover:shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-shadow`}
          >
            <div className="flex items-center gap-3 mb-4 text-white">
              {q.icon}
              <h2 className="font-semibold text-xl">{q.title}</h2>
            </div>
            <div className="flex flex-col gap-3">
              {q.options.map(opt => {
                const active = decrypted ? survey.decodedAnswer === opt : answers[q.key] === opt;
                const disabled =
                  (survey.hasAlreadySubmitted && decrypted) || (survey.hasAlreadySubmitted && !decrypted);
                return (
                  <button
                    key={opt}
                    onClick={() => handleSelect(q.key as keyof typeof answers, opt)}
                    disabled={disabled}
                    className={`p-4 rounded-2xl border font-medium text-left transition-all
                      ${active ? "bg-white/20 border-white text-white shadow-inner scale-105" : "bg-white/10 border-white/20 hover:bg-white/20 hover:scale-105"}
                      ${disabled ? "opacity-60 cursor-not-allowed hover:scale-100" : ""}`}
                  >
                    <strong>{String.fromCharCode(64 + opt)}.</strong> {q.map[opt]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!decrypted && (
        <div className="flex justify-center mt-10">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || survey.isPending}
            className={`px-12 py-4 rounded-3xl font-bold text-lg shadow-lg text-white bg-gradient-to-r from-purple-800 via-pink-800 to-red-700 hover:scale-105 transition-transform ${
              !allAnswered ? "opacity-60 cursor-not-allowed hover:scale-100" : ""
            }`}
          >
            {survey.isPending ? "⏳ Submitting..." : "🚀 Submit Health"}
          </button>
        </div>
      )}

      {Boolean((decrypted && survey.decodedAnswer) || outcome) && (
        <div className="flex justify-center mt-10">
          <div className="bg-gradient-to-r from-pink-200 via-pink-100 to-white shadow-lg rounded-2xl p-8 text-center w-[768px]">
            <h2 className="text-3xl font-bold mb-5 text-pink-500">Your Health Results</h2>
            <p className="text-lg text-cyan-600">{mapIndexToOutcome(survey?.decodedAnswer ?? outcome)}</p>
          </div>
        </div>
      )}
    </div>
  );
};
