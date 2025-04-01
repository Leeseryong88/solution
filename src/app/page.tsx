'use client';

import { useState } from 'react';
import axios, { AxiosError } from 'axios';

// 결과 데이터 타입을 위한 인터페이스 정의
interface ParsedData {
  question: string | null;
  options: string[] | null;
}

interface Solution {
  answer: string | null;
  explanation: string | null;
}

interface ApiErrorResponse {
  error: string;
}

export default function HomePage() {
  // 상태 변수들 정의
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 파일 선택 핸들러
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setIsLoading(true);
      setError(null);
      setExtractedText(null);
      setParsedData(null);
      setSolution(null);

      const formData = new FormData();
      formData.append('imageFile', file);

      try {
        const response = await axios.post('/api/solve', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.extracted_text) {
          setExtractedText(response.data.extracted_text);
        }
        if (response.data.parsed_data) {
          const parsed = response.data.parsed_data as ParsedData;
          setParsedData(parsed);
        }
        if (response.data.solution) {
          const sol = response.data.solution as Solution;
          setSolution(sol);
        }
        if (response.data.error) {
          setError(response.data.error);
        }

      } catch (error) {
        const err = error as AxiosError<ApiErrorResponse>;
        console.error('API call failed:', err);
        setError(err.response?.data?.error || '문제 분석 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 다른 문제 풀기 핸들러
  const handleNewProblem = () => {
    setExtractedText(null);
    setParsedData(null);
    setSolution(null);
    setError(null);
    // 파일 입력 필드 초기화
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h1 className="text-3xl font-bold text-center mb-8">AI 문제 풀이 도우미</h1>

                {/* 파일 업로드 섹션 */}
                <div className="flex flex-col space-y-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
                  />
                </div>

                {/* 에러 메시지 표시 */}
                {error && (
                  <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
                    오류: {error}
                  </div>
                )}

                {/* 결과 표시 섹션 */}
                {isLoading && (
                  <div className="mt-4 text-center">
                    <p className="text-gray-600">문제를 분석하고 있습니다...</p>
                  </div>
                )}

                {extractedText && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h2 className="text-xl font-semibold mb-2">추출된 텍스트:</h2>
                    <pre className="whitespace-pre-wrap break-words text-sm">{extractedText}</pre>
                  </div>
                )}

                {parsedData && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h2 className="text-xl font-semibold mb-2">분석된 문제:</h2>
                    <p className="mb-2"><strong>문제:</strong> {parsedData.question || '문제 내용 없음'}</p>
                    {parsedData.options && parsedData.options.length > 0 && (
                      <div>
                        <strong>보기:</strong>
                        <ul className="list-disc pl-5 mt-1">
                          {parsedData.options.map((option, index) => (
                            <li key={index} className="text-sm">{option}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {solution && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h2 className="text-xl font-semibold mb-2">풀이 결과:</h2>
                    <p className="mb-2"><strong>정답:</strong> {solution.answer || '정답 정보 없음'}</p>
                    <p><strong>해설:</strong></p>
                    <pre className="whitespace-pre-wrap break-words text-sm mt-1">
                      {solution.explanation || '해설 정보 없음'}
                    </pre>
                    {/* 다른 문제 풀기 버튼 */}
                    <button
                      onClick={handleNewProblem}
                      className="mt-4 w-full px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors"
                    >
                      다른 문제 풀기
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
