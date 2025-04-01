import { NextResponse } from 'next/server';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Gemini API 클라이언트 설정
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
const textModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Multer 설정: 메모리에 파일 저장
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Multer 미들웨어를 프로미스로 래핑
const runMiddleware = (req: Request, res: Response, fn: any) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

// 인터페이스 정의
interface ParsedData {
  question: string | null;
  options: string[] | null;
}

interface Solution {
  answer: string | null;
  explanation: string | null;
}

interface ErrorResponse {
  message: string;
  stack?: string;
  response?: unknown;
}

export async function POST(request: Request) {
  try {
    // FormData로 변환
    const formData = await request.formData();
    const imageFile = formData.get('imageFile') as File;

    if (!imageFile) {
      console.error('No image file provided');
      return NextResponse.json(
        { error: '이미지 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('Received file:', {
      name: imageFile.name,
      type: imageFile.type,
      size: imageFile.size
    });

    // File 객체를 Buffer로 변환
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    console.log('Buffer size:', buffer.length);

    // 1. Gemini Vision으로 텍스트 추출
    const imagePart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: imageFile.type,
      },
    };
    const visionPrompt = "이 이미지에서 모든 텍스트를 순서대로 정확하게 추출해줘.";

    let extractedText = '';
    try {
      console.log('Calling Gemini Vision API...');
      const visionResult = await visionModel.generateContent([visionPrompt, imagePart]);
      extractedText = visionResult.response.text();
      console.log("Vision API Result Text:", extractedText);
    } catch (error) {
      const err = error as Error;
      console.error("Gemini Vision API Error:", {
        message: err.message,
        stack: err.stack,
      });
      return NextResponse.json(
        { error: `이미지에서 텍스트 추출 실패: ${err.message}` },
        { status: 500 }
      );
    }

    // 2. Gemini Text로 문제/보기 분리
    const parsePrompt = `다음 텍스트에서 문제와 객관식 보기를 찾아서 JSON 형식으로 분리해줘. 결과는 반드시 {"question": "문제 내용", "options": ["보기1", "보기2", ...]} 형태의 JSON 객체 문자열이어야 해. 보기가 없으면 options는 빈 배열 []로 해줘. 다른 설명은 절대 추가하지 마. 텍스트:\n\`\`\`\n${extractedText}\n\`\`\``;
    let parsedData: ParsedData = { question: null, options: null };
    try {
      console.log('Calling Gemini Text API for parsing...');
      const parseResult = await textModel.generateContent(parsePrompt);
      const rawJsonResponse = parseResult.response.text();
      console.log("Parse API Raw Response:", rawJsonResponse);
      const jsonString = rawJsonResponse.replace(/^```json\s*|```$/g, '').trim();
      parsedData = JSON.parse(jsonString);
      console.log("Parsed Data:", parsedData);
    } catch (error) {
      const err = error as Error;
      console.error("Gemini Parse API/JSON Error:", {
        message: err.message,
        stack: err.stack,
      });
      parsedData = { question: extractedText, options: [] };
    }

    // 3. Gemini Text로 문제 풀이
    const solvePrompt = `다음 문제의 정답과 그 이유를 설명해줘. 가능한 경우 {"answer": "정답", "explanation": "풀이 과정 설명"} 형태의 JSON 객체 문자열로 응답해줘. 다른 설명은 절대 추가하지 마.\n문제: ${parsedData.question}\n보기: ${parsedData.options?.join(', ') || '없음'}`;
    let solution: Solution = { answer: null, explanation: null };
    if (parsedData.question) {
      try {
        console.log('Calling Gemini Text API for solving...');
        const solveResult = await textModel.generateContent(solvePrompt);
        const rawSolveResponse = solveResult.response.text();
        console.log("Solve API Raw Response:", rawSolveResponse);
        const solveJsonString = rawSolveResponse.replace(/^```json\s*|```$/g, '').trim();
        solution = JSON.parse(solveJsonString);
        console.log("Solution Data:", solution);
      } catch (error) {
        const err = error as Error;
        console.error("Gemini Solve API/JSON Error:", {
          message: err.message,
          stack: err.stack,
        });
        solution = { answer: "풀이 실패", explanation: `AI가 정답 및 해설 생성에 실패했습니다: ${err.message}` };
      }
    } else {
      solution = { answer: "문제 없음", explanation: "문제를 인식할 수 없어 풀이할 수 없습니다." };
    }

    // 최종 결과 반환
    return NextResponse.json({
      message: '분석 완료',
      extracted_text: extractedText,
      parsed_data: parsedData,
      solution: solution,
    });

  } catch (error) {
    const err = error as Error;
    console.error('API Route Error:', {
      message: err.message,
      stack: err.stack,
    });
    return NextResponse.json(
      { error: `서버 내부 오류 발생: ${err.message}` },
      { status: 500 }
    );
  }
} 