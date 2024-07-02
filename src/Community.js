import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth, getUserProfile, uploadPostPhoto } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import './Community.css';

const defaultProfilePicture = 'https://www.kindpng.com/picc/m/451-4517876_default-profile-hd-png-download.png';

function Community() {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [newPostPhoto, setNewPostPhoto] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'posts'), (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(sortPosts(postsData));
    });

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userProfile = await getUserProfile(user.uid);
        if (userProfile) {
          setCurrentUser({
            uid: user.uid,
            name: userProfile.name || user.email,
            profilePicture: userProfile.profilePicture || defaultProfilePicture,
          });
        } else {
          setCurrentUser({
            uid: user.uid,
            name: user.email,
            profilePicture: defaultProfilePicture,
          });
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      unsubscribe();
      authUnsubscribe();
    };
  }, []);

  const sortPosts = (posts) => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const recentPosts = posts.filter(post => post.createdAt && new Date(post.createdAt) > twoDaysAgo);
    const olderPostsWithLikes = posts.filter(post => post.createdAt && new Date(post.createdAt) <= twoDaysAgo && post.likes && post.likes.length > 0);
    const olderPostsWithoutLikes = posts.filter(post => post.createdAt && new Date(post.createdAt) <= twoDaysAgo && (!post.likes || post.likes.length === 0));
    const postsWithoutTimestamps = posts.filter(post => !post.createdAt);

    recentPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    olderPostsWithLikes.sort((a, b) => b.likes.length - a.likes.length);

    return [...recentPosts, ...olderPostsWithLikes, ...olderPostsWithoutLikes, ...postsWithoutTimestamps];
  };

  const handlePostPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewPostPhoto(file);
    }
  };

  const handleAddPost = async () => {
    if (newPost.trim() && currentUser) {
      let photoURL = null;
      if (newPostPhoto) {
        photoURL = await uploadPostPhoto(newPostPhoto);
        setNewPostPhoto(null);
      }

      const newPostData = {
        content: newPost,
        comments: [],
        likes: [],
        userName: currentUser.name,
        userProfilePicture: currentUser.profilePicture,
        createdAt: new Date().toISOString(),
        photoURL,
      };

      await addDoc(collection(db, 'posts'), newPostData);
      setNewPost('');
    }
  };

  const handleAddComment = async (postId, comment) => {
    if (comment.trim() && currentUser) {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      if (postDoc.exists()) {
        const postData = postDoc.data();
        const newComment = {
          content: comment,
          userName: currentUser.name,
          userProfilePicture: currentUser.profilePicture,
          createdAt: new Date().toISOString(),
        };
        await updateDoc(postRef, { comments: [...postData.comments, newComment] });
      } else {
        console.error('Post does not exist!');
      }
    }
  };

  const handleLike = async (postId) => {
    if (currentUser) {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      if (postDoc.exists()) {
        const postData = postDoc.data();
        const likes = postData.likes || [];
        if (likes.includes(currentUser.uid)) {
          // Remove like
          await updateDoc(postRef, { likes: likes.filter(uid => uid !== currentUser.uid) });
        } else {
          // Add like
          await updateDoc(postRef, { likes: [...likes, currentUser.uid] });
        }
      }
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const filteredPosts = posts.filter(post => 
    (post.userName && post.userName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (post.content && post.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="community-container">
      <h1>Community</h1>
      <input
        type="text"
        value={searchQuery}
        onChange={handleSearchChange}
        placeholder="Search for posts..."
        className="search-bar"
      />
      {currentUser && (
        <div className="new-post-container">
          <img src={currentUser.profilePicture} alt="Profile" className="profile-picture" />
          <input
            type="text"
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="Write a new post..."
            className="new-post-input"
          />
          <input type="file" accept="image/*" onChange={handlePostPhotoChange} />
          <button onClick={handleAddPost} className="new-post-button">Add Post</button>
        </div>
      )}
      <div className="posts-container">
        {filteredPosts.map(post => (
          <div key={post.id} className="post-card">
            <div className="post-header">
              <img src={post.userProfilePicture || defaultProfilePicture} alt="Profile" className="profile-picture" />
              <div>
                <p className="post-user-name"><strong>{post.userName}</strong></p>
                {post.createdAt && <p className="post-timestamp">{new Date(post.createdAt).toLocaleString()}</p>}
              </div>
            </div>
            <p>{post.content}</p>
            {post.photoURL && <img src={post.photoURL} alt="Post" className="post-photo" />}
            <div className="likes-comments-container">
              <button onClick={() => handleLike(post.id)} className="like-button">
                {post.likes && post.likes.includes(currentUser?.uid) ? 'Unlike' : 'Like'}
              </button>
              <span>{post.likes ? post.likes.length : 0} Likes</span>
              {post.comments.map((comment, index) => (
                <div key={index} className="comment" title={new Date(comment.createdAt).toLocaleString()}>
                  <img src={comment.userProfilePicture || defaultProfilePicture} alt="Profile" className="profile-picture" />
                  <p><strong>{comment.userName}</strong>: {comment.content}</p>
                </div>
              ))}
              <AddComment postId={post.id} onAddComment={handleAddComment} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddComment({ postId, onAddComment }) {
  const [comment, setComment] = useState('');

  const handleAddComment = () => {
    onAddComment(postId, comment);
    setComment('');
  };

  return (
    <div className="add-comment-container">
      <input
        type="text"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Write a comment..."
        className="comment-input"
      />
      <button onClick={handleAddComment} className="comment-button">Add Comment</button>
    </div>
  );
}

export default Community;