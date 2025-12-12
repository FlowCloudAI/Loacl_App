import {useState} from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import My from './Components/main.tsx';
import {api} from "./apis.tsx"

function App() {
    const [buttonText, setButtonText] = useState('点我');
    const [aiText, setAiText] = useState('');
    const [isRunning, setIsRunning] = useState(false);     // 打字机是否运行中

    async function handleClick() {
        if (isRunning) return; // 真正的防抖

        if (buttonText === '点我')
            setButtonText('加载中...')  // 先显示"加载中"

        setIsRunning(true);

        const requestBody = {
            code: 0,
            body: {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'user',
                        content: '我在对你进行测试，请输出你能输出的各种字符类型。'
                    }
                ],
                stream: true
            }
        }

        const result = await api.getAIResponse(requestBody, async ([, content]) => {
            setAiText(prev => prev + content);
            const now = new Date();
            const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            console.log(timeString + ': ' + content);
        });
        if (!result.success) {
            alert(`失败: ${result.error}`);
        }

        setIsRunning(false);
        setButtonText('点我');
    }

    return (
        <>
            <div>
                <a href="https://vite.dev" target="_blank">
                    <img src={viteLogo} className="logo" alt="Vite logo"/>
                </a>
                <a href="https://react.dev" target="_blank">
                    <img src={reactLogo} className="logo react" alt="React logo"/>
                </a>
            </div>
            <h1>Vite + React</h1>
            <div className="card">
                <p style={{ whiteSpace: 'pre-wrap' }}>{aiText}</p>
                <p>
                    <My.Button text={buttonText} click={handleClick}/>
                </p>
            </div>
            <p className="read-the-docs">
                Click on the Vite and React logos to learn more
            </p>
        </>
    )
}

export default App
