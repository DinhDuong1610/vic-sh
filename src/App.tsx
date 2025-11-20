import React, { useState, useEffect } from 'react';
import {
    Card, Button, Input, Form, Table, Tag,
    message, Modal, Typography, Row, Col, InputNumber, Spin
} from 'antd';
import {
    UserOutlined, TeamOutlined, CrownOutlined,
    CheckCircleOutlined, RocketOutlined, SafetyCertificateOutlined,
    TrophyOutlined, BarChartOutlined, LogoutOutlined
} from '@ant-design/icons';
import './App.css';
import Logo from './assets/logo.png';

const { Title, Text } = Typography;

const API_URL = import.meta.env.VITE_API_URL as string;
const BCN_CODE = import.meta.env.VITE_BCN_CODE as string;

type Screen = 'LOGIN' | 'MENU' | 'VOTE_SELECTION' | 'WAITING' | 'RESULTS' | 'BCN_GRADING';

interface Group {
    tenNhom: string;
    deTai: string;
    tongDiem: number;
    xepHang: number;
    diemBGK?: number;
}

function App() {
    const [screen, setScreen] = useState<Screen>('LOGIN');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [user, setUser] = useState<any>(null);
    const [groups, setGroups] = useState<Group[]>([]);
    const [bcnScores, setBcnScores] = useState<{ [key: string]: string }>({});

    const [loading, setLoading] = useState(false);
    const [votingGroup, setVotingGroup] = useState<string | null>(null);
    const [loginForm] = Form.useForm();

    const [isRacing, setIsRacing] = useState(false);
    const [displayScores, setDisplayScores] = useState<{ [key: string]: number }>({});

    const [modal, modalContextHolder] = Modal.useModal();
    const [messageApi, messageContextHolder] = message.useMessage();

    useEffect(() => {
        const savedMSV = localStorage.getItem('user_msv');
        const savedName = localStorage.getItem('user_name');
        const hasVoted = localStorage.getItem(`voted_${savedMSV}`);

        if (savedMSV && screen === 'LOGIN') {
            setUser({ name: savedName, msv: savedMSV });
            if (hasVoted) {
                setScreen('WAITING');
            } else {
                setScreen('MENU');
            }
        }
    }, []);

    useEffect(() => {
        const interval = setInterval(checkDataStatus, 5000);
        return () => clearInterval(interval);
    }, [screen]);

    const checkDataStatus = async () => {
        try {
            const res = await fetch(API_URL);
            const json = await res.json();
            if (json.status === 'success') {
                setGroups(json.data);
                if (json.isPublished) {
                    if (screen === 'WAITING' || screen === 'VOTE_SELECTION' || screen === 'MENU') {
                        triggerResultReveal(json.data);
                    }
                }
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            // Handle error silently
        }
    };

    const triggerResultReveal = (realGroups: Group[]) => {
        if (screen === 'RESULTS') return;
        setScreen('RESULTS');
        setIsRacing(true);

        const startTime = Date.now();
        const duration = 12000;

        const raceInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            if (elapsed < duration) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fakeScores: any = {};
                realGroups.forEach(g => {
                    fakeScores[g.tenNhom] = 10;
                });
                setDisplayScores(fakeScores);
            } else {
                clearInterval(raceInterval);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const finalScores: any = {};
                realGroups.forEach(g => {
                    finalScores[g.tenNhom] = g.tongDiem;
                });
                setDisplayScores(finalScores);
                setIsRacing(false);
                messageApi.success({ content: '🎉 KẾT QUẢ CHÍNH THỨC! 🎉', style: { marginTop: '10vh' }, duration: 5 });
            }
        }, 700);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleLogin = async (values: any) => {
        setLoading(true);
        try {
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'LOGIN', ...values }),
                mode: "no-cors"
            });
            setUser(values);
            localStorage.setItem('user_msv', values.msv);
            localStorage.setItem('user_name', values.name);
            messageApi.success("Đăng nhập thành công!");

            const votedKey = `voted_${values.msv}`;
            if (localStorage.getItem(votedKey)) {
                setScreen('WAITING');
            } else {
                setScreen('MENU');
            }
            checkDataStatus();
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            messageApi.error("Lỗi kết nối!");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        window.location.reload();
    };

    const handleEnterBCN = () => {
        const code = prompt("Nhập mã BCN");
        if (code === BCN_CODE) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const initialScores: any = {};
            groups.forEach(g => {
                initialScores[g.tenNhom] = g.diemBGK !== undefined ? String(g.diemBGK) : '';
            });
            setBcnScores(initialScores);
            setScreen('BCN_GRADING');
        } else {
            messageApi.error("Mã không đúng!");
        }
    };

    const handleVote = (groupName: string) => {
        modal.confirm({
            title: <div style={{ fontSize: '1.2rem', color: '#1890ff' }}>Xác nhận bình chọn</div>,
            icon: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '2rem' }} />,
            content: (
                <div style={{ marginTop: 10 }}>
                    Bạn chắc chắn muốn vote cho nhóm <b style={{ color: '#722ed1', fontSize: '1.1rem' }}>{groupName}</b>?<br />
                    <i style={{ color: '#888' }}>Lưu ý: Bạn chỉ được vote 1 lần duy nhất.</i>
                </div>
            ),
            okText: 'VOTE LUÔN',
            cancelText: 'Suy nghĩ lại',
            centered: true,
            onOk: async () => {
                setVotingGroup(groupName);
                try {
                    await fetch(API_URL, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'VOTE', groupName }),
                        mode: "no-cors"
                    });
                    localStorage.setItem(`voted_${user.msv}`, 'true');
                    messageApi.success("Đã gửi vote thành công!");
                    setScreen('WAITING');
                } catch (e) {
                    messageApi.error("Lỗi mạng, vui lòng thử lại!");
                } finally {
                    setVotingGroup(null);
                }
            }
        });
    };

    const handleScoreChange = (groupName: string, value: string) => {
        setBcnScores(prev => ({ ...prev, [groupName]: value }));
    };

    const handleSubmitScores = () => {
        modal.confirm({
            title: 'Gửi bảng điểm',
            icon: <SafetyCertificateOutlined style={{ color: '#faad14' }} />,
            content: 'Điểm sẽ được cộng dồn. Bạn chắc chắn chứ?',
            okText: 'Gửi Điểm',
            cancelText: 'Hủy',
            centered: true,
            onOk: async () => {
                const payload = Object.keys(bcnScores).map(key => ({
                    groupName: key,
                    score: bcnScores[key]
                }));
                setLoading(true);
                await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'SUBMIT_SCORES', scores: payload }),
                    mode: "no-cors"
                });
                setLoading(false);
                messageApi.success("Đã cập nhật điểm!");
            }
        });
    };

    const handlePublish = () => {
        modal.confirm({
            title: 'CÔNG BỐ KẾT QUẢ',
            icon: <TrophyOutlined style={{ color: '#f5222d' }} />,
            content: 'Toàn bộ khán giả sẽ nhìn thấy bảng xếp hạng ngay lập tức.',
            okText: 'CÔNG BỐ NGAY',
            okType: 'danger',
            centered: true,
            onOk: async () => {
                await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'PUBLISH' }),
                    mode: "no-cors"
                });
                messageApi.success("Đã phát lệnh công bố!");
                triggerResultReveal(groups);
            }
        });
    };

    const AppHeader = () => (
        <div style={{ textAlign: 'center' }}>
            <img src={Logo} alt="CLB Logo" className="clb-logo animate__animated animate__bounceIn" />
        </div>
    );

    return (
        <div className="container">
            {modalContextHolder}
            {messageContextHolder}

            {screen === 'LOGIN' && (
                <div className="animate__animated animate__fadeIn">
                    <AppHeader />
                    <div className="card-glass" style={{ maxWidth: 500, margin: '0 auto' }}>
                        <Title className="title-gradient">CHECK-IN</Title>
                        <Text className="subtitle">Hệ thống bình chọn trực tuyến</Text>
                        <Form form={loginForm} onFinish={handleLogin} layout="vertical" size="large" style={{ marginTop: 20 }}>
                            <Form.Item name="name" rules={[{ required: true, message: 'Nhập họ tên!' }]}>
                                <Input prefix={<UserOutlined className="site-form-item-icon" />} placeholder="Họ và tên" />
                            </Form.Item>
                            <Form.Item name="msv" rules={[{ required: true, message: 'Nhập mã sinh viên!' }]}>
                                <Input prefix={<SafetyCertificateOutlined />} placeholder="Mã sinh viên" />
                            </Form.Item>
                            <Form.Item name="class" rules={[{ required: true, message: 'Nhập lớp!' }]}>
                                <Input prefix={<TeamOutlined />} placeholder="Lớp" />
                            </Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading} block shape="round">
                                THAM GIA NGAY
                            </Button>
                        </Form>
                    </div>
                </div>
            )}

            {screen === 'MENU' && (
                <div className="animate__animated animate__fadeInUp">
                    <AppHeader />
                    {/* <Title level={3} style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                        Xin chào, {user?.name}
                    </Title> */}
                    <Row gutter={[20, 20]} justify="center" style={{ marginTop: 30 }}>
                        <Col xs={24} md={10}>
                            <Card hoverable className="card-glass" onClick={() => setScreen('VOTE_SELECTION')} style={{ cursor: 'pointer', height: '100%' }}>
                                <div style={{ textAlign: 'center', padding: 20 }}>
                                    <RocketOutlined style={{ fontSize: 60, color: '#1890ff', marginBottom: 20 }} />
                                    <Title level={4} style={{ margin: 0 }}>BÌNH CHỌN NHÓM</Title>
                                    <Text type="secondary">Dành cho Khán Giả</Text>
                                </div>
                            </Card>
                        </Col>
                        <Col xs={24} md={10}>
                            <Card hoverable className="card-glass" onClick={handleEnterBCN} style={{ cursor: 'pointer', height: '100%' }}>
                                <div style={{ textAlign: 'center', padding: 20 }}>
                                    <CrownOutlined style={{ fontSize: 60, color: '#fadb14', marginBottom: 20 }} />
                                    <Title level={4} style={{ margin: 0 }}>BAN CHỦ NHIỆM</Title>
                                    <Text type="secondary">Khu vực Chấm Điểm</Text>
                                </div>
                            </Card>
                        </Col>
                    </Row>
                    <Button type="text" icon={<LogoutOutlined />} style={{ color: 'rgba(255,255,255,0.7)', marginTop: 30 }} onClick={handleLogout}>Đăng xuất</Button>
                </div>
            )}

            {screen === 'VOTE_SELECTION' && (
                <div className="animate__animated animate__fadeInRight">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <Button type="default" shape="circle" icon={<LogoutOutlined />} onClick={() => setScreen('MENU')} />
                        <Title level={3} style={{ color: 'white', margin: 0, textShadow: '0 2px 2px rgba(0,0,0,0.3)' }}>CHỌN ĐỘI THI</Title>
                        <div style={{ width: 32 }}></div>
                    </div>

                    <Row gutter={[16, 16]}>
                        {groups.map((g, idx) => (
                            <Col xs={24} md={12} lg={8} key={idx}>
                                <Card hoverable className="card-glass" style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                        <div style={{ flex: 1 }}>
                                            <Tag color="blue" style={{ fontSize: '1rem', padding: '4px 10px', marginBottom: 10 }}>#{idx + 1}</Tag>
                                            <Title level={4} style={{ margin: '5px 0', color: '#333', minHeight: '3em' }}>{g.tenNhom}</Title>
                                            <Text type="secondary" italic><RocketOutlined /> {g.deTai}</Text>
                                        </div>
                                        <Button type="primary" shape="round" size="large"
                                            icon={<CheckCircleOutlined />}
                                            loading={votingGroup === g.tenNhom} // Chỉ xoay nút của nhóm này
                                            onClick={() => handleVote(g.tenNhom)}
                                            style={{ marginTop: 20, width: '100%' }}>
                                            BÌNH CHỌN
                                        </Button>
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </div>
            )}

            {screen === 'WAITING' && (
                <div className="animate__animated animate__zoomIn">
                    <AppHeader />
                    <div className="card-glass" style={{ textAlign: 'center', padding: '60px 20px', maxWidth: 600, margin: '0 auto' }}>
                        <CheckCircleOutlined style={{ fontSize: 80, color: '#52c41a', marginBottom: 20 }} />
                        <Title level={2} style={{ color: '#52c41a' }}>ĐÃ GHI NHẬN!</Title>
                        <Text style={{ fontSize: '1.1rem' }}>Cảm ơn bạn đã tham gia bình chọn.</Text>

                        <div style={{ marginTop: 40, padding: 20, background: 'rgba(255,255,255,0.5)', borderRadius: 15 }}>
                            <Spin size="large" />
                            <div style={{ marginTop: 15, fontWeight: '600', color: '#555' }}>
                                Đang chờ Ban Chủ Nhiệm công bố kết quả...
                            </div>
                            <Text type="secondary" style={{ fontSize: 12 }}>Vui lòng không tắt màn hình này</Text>
                        </div>
                    </div>
                </div>
            )}

            {screen === 'BCN_GRADING' && (
                <div className="animate__animated animate__fadeIn">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <Button type="default" onClick={() => setScreen('MENU')}>← Quay lại</Button>
                        <Tag color="gold" style={{ fontSize: 14, padding: '5px 10px' }}>CHẾ ĐỘ GIÁM KHẢO</Tag>
                    </div>

                    <div className="card-glass">
                        <Title level={3} style={{ color: '#cf1322', textAlign: 'center', marginBottom: 30 }}>BẢNG CHẤM ĐIỂM</Title>

                        <Table
                            dataSource={groups}
                            rowKey="tenNhom"
                            pagination={false}
                            className="grading-table"
                            columns={[
                                { title: 'Nhóm', dataIndex: 'tenNhom', key: 'tenNhom', render: t => <b style={{ fontSize: '1rem' }}>{t}</b> },
                                { title: 'Đề tài', dataIndex: 'deTai', key: 'deTai', responsive: ['md'] },
                                {
                                    title: 'Điểm (0-10)', key: 'score', width: 150,
                                    render: (_, record) => (
                                        <InputNumber min={0} max={10} step={0.1} size="large" style={{ width: '100%' }}
                                            placeholder="Nhập điểm"
                                            value={Number(bcnScores[record.tenNhom]) || 0}
                                            onChange={(val) => handleScoreChange(record.tenNhom, String(val))}
                                        />
                                    )
                                }
                            ]}
                        />

                        <Row gutter={16} style={{ marginTop: 30 }}>
                            <Col xs={24} sm={12} style={{ marginBottom: 10 }}>
                                <Button type="primary" block icon={<CheckCircleOutlined />} size="large" onClick={handleSubmitScores} loading={loading}>
                                    GỬI BẢNG ĐIỂM
                                </Button>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Button type="primary" danger block icon={<BarChartOutlined />} size="large" onClick={handlePublish}>
                                    📢 CÔNG BỐ KẾT QUẢ
                                </Button>
                            </Col>
                        </Row>
                    </div>
                </div>
            )}

            {screen === 'RESULTS' && (
                <div className="container">
                    <AppHeader />
                    <Title className="title-gradient" style={{ fontSize: '2.5rem', textAlign: 'center', textShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                        {isRacing ? 'ĐANG TỔNG HỢP...' : '🏆 KẾT QUẢ CHUNG CUỘC 🏆'}
                    </Title>

                    <div className="chart-container">
                        {groups.map((g, idx) => {
                            const score = displayScores[g.tenNhom] || 0;
                            const maxScore = Math.max(...Object.values(displayScores), 10);
                            const baseMax = isRacing ? 100 : (maxScore * 1.1);
                            const heightPercent = (score / baseMax) * 100;

                            let rankClass = '';
                            let icon = null;
                            if (!isRacing) {
                                if (g.xepHang === 1) { rankClass = 'rank-1'; icon = '🥇'; }
                                else if (g.xepHang === 2) { rankClass = 'rank-2'; icon = '🥈'; }
                                else if (g.xepHang === 3) { rankClass = 'rank-3'; icon = '🥉'; }
                            }

                            return (
                                <div key={idx} className={`chart-bar-wrapper ${rankClass}`}>
                                    <div className="chart-bar" style={{ height: `${Math.max(heightPercent, 8)}%` }}>
                                        <div className="score-float">{isRacing ? Math.floor(score) : score.toFixed(1)}</div>
                                    </div>

                                    {!isRacing && icon && <div className="medal-icon">{icon}</div>}

                                    <div className="bar-label-container">
                                        <div className="bar-label">{g.tenNhom}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {!isRacing && (
                        <div className="card-glass animate__animated animate__fadeInUp" style={{ marginTop: 30 }}>
                            <Table dataSource={[...groups].sort((a, b) => a.xepHang - b.xepHang)} rowKey="tenNhom" pagination={false}
                                columns={[
                                    {
                                        title: 'Hạng', dataIndex: 'xepHang', align: 'center', width: 80,
                                        render: r => r === 1 ? <span style={{ fontSize: 24 }}>🥇</span> : r === 2 ? <span style={{ fontSize: 24 }}>🥈</span> : r === 3 ? <span style={{ fontSize: 24 }}>🥉</span> : <span style={{ fontWeight: 'bold' }}>{r}</span>
                                    },
                                    { title: 'Nhóm', dataIndex: 'tenNhom', render: t => <b style={{ fontSize: '1.1rem', color: '#333' }}>{t}</b> },
                                    { title: 'Tổng Điểm', dataIndex: 'tongDiem', align: 'right', render: d => <Tag color="green" style={{ fontSize: 16, padding: '4px 10px' }}>{Number(d).toFixed(2)}</Tag> }
                                ]}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default App;